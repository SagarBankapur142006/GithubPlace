import paramiko
import os

def main():
    ip = "34.224.7.229"
    key_path = os.path.join(os.path.dirname(__file__), '..', 'temp', 'ideora-deploy-key.pem')
    
    print(f"Connecting to {ip} to trigger redeployment...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        private_key = paramiko.RSAKey.from_private_key_file(key_path)
        ssh.connect(hostname=ip, username="ubuntu", pkey=private_key)
        print("Connected successfully! Pulling latest code and building containers...")
        
        # Pull code and build compose
        commands = [
            "sudo git config --global --add safe.directory /app",
            "cd /app",
            "sudo git pull",
            "sudo docker compose up --build -d"
        ]
        
        full_command = " && ".join(commands)
        stdin, stdout, stderr = ssh.exec_command(full_command)
        
        # Paramiko exec_command is non-blocking. Let's read the output as it compiles.
        # We can read line by line.
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
