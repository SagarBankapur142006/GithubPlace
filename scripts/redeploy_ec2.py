import paramiko
import os

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
    ip = "34.224.7.229"
    key_path = os.path.join(os.path.dirname(__file__), '..', 'temp', 'ideora-deploy-key.pem')
    
    # Load local backend/.env to get the OAuth credentials
    env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
    env_vars = load_env(env_path)
    
    client_id = env_vars.get('GITHUB_CLIENT_ID', '')
    client_secret = env_vars.get('GITHUB_CLIENT_SECRET', '')
    
    print(f"Connecting to {ip} to trigger redeployment...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        private_key = paramiko.RSAKey.from_private_key_file(key_path)
        ssh.connect(hostname=ip, username="ubuntu", pkey=private_key)
        print("Connected successfully! Pulling latest code, updating config, and building containers...")
        
        # Pull code, update env secrets, and build compose
        commands = [
            "sudo git config --global --add safe.directory /app",
            "cd /app",
            "sudo git pull",
            f"sudo sed -i 's/^GITHUB_CLIENT_ID=.*/GITHUB_CLIENT_ID={client_id}/' backend/.env || true",
            f"sudo sed -i 's/^GITHUB_CLIENT_SECRET=.*/GITHUB_CLIENT_SECRET={client_secret}/' backend/.env || true",
            f"sudo grep -q '^GITHUB_CLIENT_ID=' backend/.env || echo 'GITHUB_CLIENT_ID={client_id}' | sudo tee -a backend/.env",
            f"sudo grep -q '^GITHUB_CLIENT_SECRET=' backend/.env || echo 'GITHUB_CLIENT_SECRET={client_secret}' | sudo tee -a backend/.env",
            "sudo docker compose up --build -d"
        ]
        
        full_command = " && ".join(commands)
        stdin, stdout, stderr = ssh.exec_command(full_command)
        
        for line in stdout:
            print(line, end="")
            
        err = stderr.read().decode('utf-8')
        if err:
            print("\n--- STDERR ---")
            print(err)
            
    except Exception as e:
        print(f"Deployment control failed: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    main()
