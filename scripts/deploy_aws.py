import os
import time
import boto3
from botocore.exceptions import ClientError

def load_env(env_path):
    env_vars = {}
    if not os.path.exists(env_path):
        return env_vars
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                env_vars[key.strip()] = value.strip()
    return env_vars

def main():
    print("🚀 Initializing AWS EC2 Deployment...")
    
    # Load environment variables from local .env to propagate to EC2
    env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
    env_vars = load_env(env_path)
    
    github_token = env_vars.get('GITHUB_TOKEN', '')
    gemini_key = env_vars.get('GEMINI_API_KEY', '')
    razorpay_id = env_vars.get('RAZORPAY_KEY_ID', '')
    razorpay_secret = env_vars.get('RAZORPAY_KEY_SECRET', '')
    razorpay_webhook = env_vars.get('RAZORPAY_WEBHOOK_SECRET', 'webhook_placeholder')
    jwt_secret = env_vars.get('JWT_SECRET', 'change-me-in-production-use-long-random-string')
    
    if not github_token:
        print("⚠️ Warning: GITHUB_TOKEN not found in backend/.env. Repo cloning might fail if private.")
        
    # Setup AWS Clients
    ec2_client = boto3.client('ec2', region_name='us-east-1')
    ec2_resource = boto3.resource('ec2', region_name='us-east-1')
    
    # 1. Create/Get SSH Key Pair
    key_name = 'ideora-deploy-key'
    key_dir = os.path.join(os.path.dirname(__file__), '..', 'temp')
    os.makedirs(key_dir, exist_ok=True)
    key_file_path = os.path.join(key_dir, f'{key_name}.pem')
    
    print(f"🔑 Setting up Key Pair: {key_name}...")
    try:
        key_pair = ec2_client.create_key_pair(KeyName=key_name)
        with open(key_file_path, 'w', encoding='utf-8') as f:
            f.write(key_pair['KeyMaterial'])
        # Set read-only permissions for owner on Linux/macOS (chmod 400 equivalent on Windows is handled differently, but we write it)
        print(f"✅ Key pair created and saved to {key_file_path}")
    except ClientError as e:
        if 'InvalidKeyPair.Duplicate' in str(e):
            print(f"ℹ️ Key pair {key_name} already exists. Using existing one.")
        else:
            raise e

    # 2. Create/Get Security Group
    sg_name = 'ideora-sg'
    print(f"🛡️ Setting up Security Group: {sg_name}...")
    try:
        vpcs = ec2_client.describe_vpcs(Filters=[{'Name': 'is-default', 'Values': ['true']}])
        vpc_id = vpcs['Vpcs'][0]['VpcId']
    except IndexError:
        # If no default VPC, get the first available one
        vpcs = ec2_client.describe_vpcs()
        vpc_id = vpcs['Vpcs'][0]['VpcId']
        
    sg_id = None
    try:
        response = ec2_client.create_security_group(
            GroupName=sg_name,
            Description='Security Group for Ideora Marketplace',
            VpcId=vpc_id
        )
        sg_id = response['GroupId']
        print(f"✅ Created Security Group {sg_name} ({sg_id})")
        
        # Authorize ports 22, 80, 8000
        ec2_client.authorize_security_group_ingress(
            GroupId=sg_id,
            IpPermissions=[
                {
                    'IpProtocol': 'tcp',
                    'FromPort': 22,
                    'ToPort': 22,
                    'IpRanges': [{'CidrIp': '0.0.0.0/0', 'Description': 'SSH'}]
                },
                {
                    'IpProtocol': 'tcp',
                    'FromPort': 80,
                    'ToPort': 80,
                    'IpRanges': [{'CidrIp': '0.0.0.0/0', 'Description': 'HTTP'}]
                },
                {
                    'IpProtocol': 'tcp',
                    'FromPort': 8000,
                    'ToPort': 8000,
                    'IpRanges': [{'CidrIp': '0.0.0.0/0', 'Description': 'FastAPI Backend API'}]
                }
            ]
        )
        print("✅ Rules authorized: 22, 80, 8000 open to the world.")
    except ClientError as e:
        if 'InvalidGroup.Duplicate' in str(e):
            groups = ec2_client.describe_security_groups(GroupNames=[sg_name])
            sg_id = groups['SecurityGroups'][0]['GroupId']
            print(f"ℹ️ Security Group {sg_name} already exists ({sg_id}). Using existing one.")
        else:
            raise e

    # 3. Query Latest Ubuntu 24.04 LTS AMI
    print("🔍 Fetching latest Ubuntu 24.04 Noble LTS AMI...")
    response = ec2_client.describe_images(
        Owners=['099720109477'], # Canonical
        Filters=[
            {'Name': 'name', 'Values': ['ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*']},
            {'Name': 'state', 'Values': ['available']}
        ]
    )
    # Sort images by CreationDate to get the newest
    images = sorted(response['Images'], key=lambda x: x['CreationDate'], reverse=True)
    ami_id = images[0]['ImageId']
    print(f"✅ Selected AMI: {ami_id} ({images[0]['Name']})")

    # 4. Define User Data (Startup Script)
    user_data = f"""#!/bin/bash
# Exit on error
set -e

# Update and upgrade packages
apt-get update -y
apt-get install -y git curl apt-transport-https ca-certificates gnupg lsb-release

# 1. Create a 2GB swap file to prevent Next.js out-of-memory errors during build
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 2. Install Docker
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker
systemctl start docker

# 3. Prepare workspace directory
mkdir -p /app
cd /app

# Clone repository using the GitHub Token
git clone https://x-access-token:{github_token}@github.com/SagarBankapur142006/GithubPlace.git .

# 4. Construct .env configuration for backend
cat << 'EOF' > backend/.env
USE_SQLITE=false
DATABASE_URL=postgresql+asyncpg://ideora:ideora@postgres:5432/ideora
SYNC_DATABASE_URL=postgresql://ideora:ideora@postgres:5432/ideora
JWT_SECRET={jwt_secret}
FRONTEND_URL=http://localhost
BACKEND_URL=http://localhost:8000
GITHUB_TOKEN={github_token}
GEMINI_API_KEY={gemini_key}
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
RAZORPAY_KEY_ID={razorpay_id}
RAZORPAY_KEY_SECRET={razorpay_secret}
RAZORPAY_WEBHOOK_SECRET={razorpay_webhook}
EOF

# 5. Launch Application
docker compose up --build -d
"""

    # 5. Launch EC2 Instance
    print("⚡ Launching EC2 Instance (t3.micro)...")
    try:
        instances = ec2_resource.create_instances(
            ImageId=ami_id,
            MinCount=1,
            MaxCount=1,
            InstanceType='t3.micro', # standard free tier instance type
            KeyName=key_name,
            SecurityGroupIds=[sg_id],
            UserData=user_data,
            BlockDeviceMappings=[{
                'DeviceName': '/dev/sda1',
                'Ebs': {
                    'VolumeSize': 20,
                    'VolumeType': 'gp3',
                    'DeleteOnTermination': True
                }
            }],
            TagSpecifications=[{
                'ResourceType': 'instance',
                'Tags': [{'Key': 'Name', 'Value': 'Ideora-Marketplace'}]
            }]
        )
        
        instance = instances[0]
        print(f"⏳ Instance created: {instance.id}. Waiting for it to run and fetch IP...")
        
        instance.wait_until_running()
        instance.reload() # Refresh status to obtain public IP
        
        public_ip = instance.public_ip_address
        public_dns = instance.public_dns_name
        
        print("\n" + "="*50)
        print("🎉 IDEORA AWS DEPLOYMENT INITIALIZED SUCCESSFULLY!")
        print("="*50)
        print(f"🔹 Instance ID:   {instance.id}")
        print(f"🔹 Public IP:     {public_ip}")
        print(f"🔹 Public DNS:    {public_dns}")
        print(f"🔹 SSH Key Saved: {key_file_path}")
        print(f"🔹 Launch URL:    http://{public_ip}/")
        print("="*50)
        print("\nℹ️  Docker and the containers are compiling/launching in the background.")
        print("ℹ️  This build (including Next.js compilation) takes about 2-3 minutes to finish.")
        print("ℹ️  You can monitor status by SSH-ing to the instance:")
        print(f"    ssh -i temp/{key_name}.pem ubuntu@{public_ip}")
        print("    And running: tail -f /var/log/cloud-init-output.log")
        print("="*50)
        
    except Exception as e:
        print(f"❌ Failed to launch instance: {e}")

if __name__ == '__main__':
    main()
