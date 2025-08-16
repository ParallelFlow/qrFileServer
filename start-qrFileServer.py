#!/usr/bin/env python3
import subprocess, sys, os, argparse, base64

def main():
    parser = argparse.ArgumentParser(description='Process file paths.')
    parser.add_argument('paths', nargs='+', help='List of file paths')
    parser.add_argument('--readonly', action='store_true', help='Set read-only mode')

    args = parser.parse_args()

    qr_file_server_input = ""

    for path in args.paths:
        full_path = os.path.realpath(path)
        if not os.path.exists(full_path):
            print(f"Cannot get the full path of {path}. Try entering the full path of that path instead.")
            sys.exit(1)
        else:
            encoded_path = base64.b64encode(full_path.encode()).decode()
            qr_file_server_input += f"<{encoded_path}>|"

    os.chdir(os.path.dirname(os.path.realpath(__file__)))

    os.environ['QR_FILE_SERVER_READONLY'] = str(args.readonly).lower()
    os.environ['QR_FILE_SERVER_INPUT'] = qr_file_server_input


    venv_name = 'venv'

    if os.name == 'nt':  # windows
        #gunicorn_path = os.path.join(venv_name, 'Scripts', 'gunicorn.exe')
        print("Currently this project depends on gunicorn which doesn't support windows, try windows wsgi instead.")
        sys.exit(1)
    else:  # unix systems
        gunicorn_path = os.path.join(venv_name, 'bin', 'gunicorn')

    gunicorn_cmd = [gunicorn_path, "-c", "qrFileServerConfig.py", "app:app"]
    subprocess.run(gunicorn_cmd)

if __name__ == "__main__":
    main()

