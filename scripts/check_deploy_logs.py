import paramiko
import os
import sys

def main():
    ip = "34.224.7.229"
    key_path = os.path.join(os.path.dirname(__file__), '..', 'temp', 'ideora-deploy-key.pem')
    
    print(f"Connecting to {ip} using key {key_path}...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # Load the private key using paramiko
        private_key = paramiko.RSAKey.from_private_key_file(key_path)
        
        # Connect
        ssh.connect(hostname=ip, username="ubuntu", pkey=private_key)
        print("Connected! Fetching last 30 lines of cloud-init-output.log...")
        
        stdin, stdout, stderr = ssh.exec_command("tail -n 40 /var/log/cloud-init-output.log")
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        if output:
            print("\n--- STDOUT ---")
            print(output)
        if error:
            print("\n--- STDERR ---")
            print(error)
            
        # Check active docker containers
        stdin, stdout, stderr = ssh.exec_command("sudo docker ps")
        docker_output = stdout.read().decode('utf-8')
        print("\n--- DOCKER CONTAINERS ---")
        print(docker_output if docker_output else "No containers running yet.")
        
    except Exception as e:
        print(f"Connection failed: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    main()
