#!/usr/bin/env python3
import subprocess, sys, os, argparse, base64


def parse_gunicorn_bind_args(gunicorn_args):
    """
    This is a way to pass some of the gunicorn args so it can be used  
    to configure qrFileServer.

    :param gunicorn_args: An array of args.
    """
    gunicorn_parser = argparse.ArgumentParser(add_help=False)
    gunicorn_parser.add_argument('--bind', type=str, dest='bind')
    gunicorn_parser.add_argument('-b', type=str, dest='bind')
    gunicorn_parser.add_argument('--certfile', type=str, dest='certfile')
    gunicorn_parser.add_argument('--keyfile', type=str, dest='keyfile')
    args, unknown_args = gunicorn_parser.parse_known_args(gunicorn_args)
    if args.bind: # set the environment variable so I can make qrcode later.
        #since gunicorn uses $(HOST), $(HOST):$(PORT) format, we need to convert it.
        if args.bind.startswith('fd://') or args.bind.startswith('unix:'):
            os.environ['QR_FILE_SERVER_BIND'] = args.bind
        else:
            hosts = [part.strip() for part in args.bind.split(',')]
            if ':' in hosts[-1]:
                host_part, port_part = hosts[-1].rsplit(':', 1)
            binding = [f'{host}:{port_part}' for host in hosts[:-1]]
            binding.append(hosts[-1])
            binding = ','.join(binding)
            os.environ['QR_FILE_SERVER_BIND'] = binding
    if args.certfile and args.keyfile:
        os.environ['QR_FILE_SERVER_SECURE'] = 'true'
    else:
        os.environ['QR_FILE_SERVER_SECURE'] = 'false'

def main():
    parser = argparse.ArgumentParser(description='Process file paths.')
    parser.add_argument('paths', nargs='+', help='List of file paths')
    parser.add_argument('--readonly', action='store_true', help='Set read-only mode')
    parser.add_argument('--token', type=str, help='Enter custom token/password for authentication')
    parser.add_argument('--gunicorn-args', type=str, help='Add custom gunicorn arguments')

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
    os.environ['QR_FILE_SERVER_SECURE'] = 'false'
    os.environ['QR_FILE_SERVER_INPUT'] = qr_file_server_input
    if args.token:
        os.environ['QR_FILE_SERVER_TOKEN'] = args.token

    venv_name = 'venv'

    if os.name == 'nt':  # windows
        #gunicorn_path = os.path.join(venv_name, 'Scripts', 'gunicorn.exe')
        print("Currently this project depends on gunicorn which doesn't support windows, try windows wsl instead.")
        sys.exit(1)
    else:  # unix systems
        gunicorn_path = os.path.join(venv_name, 'bin', 'gunicorn')

    if args.gunicorn_args:
        gunicorn_args = args.gunicorn_args.split()
        parse_gunicorn_bind_args(args.gunicorn_args.split())
    else:
        gunicorn_args = []


    gunicorn_cmd = [gunicorn_path] + gunicorn_args + ["-c", "gunicornConfig.py", "app:app"]
    subprocess.run(gunicorn_cmd)

if __name__ == "__main__":
    main()

