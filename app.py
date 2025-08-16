import os, qrFileServerConfig, tempfile, atexit, shutil, io, zipfly, base64, math
from modules.generateQrcode import generate_unicode_qr
from flask import Flask, request, send_from_directory, abort, render_template, jsonify, Response
from werkzeug.utils import secure_filename, safe_join

app = Flask(__name__)





def authenticate():
    """
    Handle authentication by checking url args, cookies, or http auth.

    :return: Sends a 401 response if not authenticated and return none if authenticated
    """
    auth = request.authorization
    if request.args.get('token') == TOKEN:
        return
    if request.cookies.get('token') == TOKEN:
        return
    elif not auth or not (auth.username in USERS and USERS[auth.username] == auth.password):
        return Response(
            'Please provide valid credentials.', 401,
            {'WWW-Authenticate': 'Basic realm="Login Required"'})

def cleanup():
    if os.path.exists(TEMPDIR):
        print(f"Cleanup {TEMPDIR}")
        shutil.rmtree(TEMPDIR)

def setup_upload_paths(paths):
    """
    Setup the upload folder according to a given path.

    :param paths: A string of paths where each path is base64 encoded (to prevent
    parsing errors with special characters in paths) and seperated by pipe characters
    :return: A string to the upload folder path.
    """

    if not paths:
        print(f"Error: No input. Is the enviroment variable QR_FILE_SERVER_INPUT set?")
        os._exit(1)

    # Remove the trailing pipe if it exists
    if paths.endswith('|'):
        paths = paths[:-1]

    pathsList = paths.split('|')

    for path in pathsList:
        try:
            decodedPath = base64.b64decode(path).decode('utf-8')
        except (base64.binascii.Error, UnicodeDecodeError) as e:
            print("Cannot decode the enviroment variable input path.")
            print(f"Error output: {e}")
            os._exit(1)
        if not os.path.exists(decodedPath):
            print(f"Error: The path {decodedPath} does not exist.")
            os._exit(1)
        else:
            # Create a symbolic link
            linked_path = os.path.join(TEMPDIR, os.path.basename(decodedPath))
            os.symlink(decodedPath, linked_path)
            print(f"Symbolic link created: {decodedPath} -> {linked_path}")
            if len(pathsList) == 1 and os.path.isdir(linked_path):
                return linked_path
    return TEMPDIR




def secure_folderpath(root, user_input_folder):
    """
    A wrapper for safe_join to join untrusted path with some base directory. It will
    return the safe path and if not, create a safe path with secure_filename

    :param root: The base directory where uploads are allowed
    :param user_input_folder: The relative directory of the upload folder
    :return: Either the original user input or a sanitized version.
    """
    safe_path = safe_join(root, user_input_folder)
    # check if the normalized path starts with the upload folder path
    if safe_path:
        return safe_path
    else:
        # fallback to secure_filename
        return secure_filename(user_input_folder)



@app.before_request
def before_every_request():
    """Authentication and logging before each request"""
    readonlyAPI = {'/upload', '/delete', '/move', '/newfile', '/newfolder'}
    if READONLY and request.path in readonlyAPI:
        return {'message': 'This site is in read only mode'}, 405

    if authenticate(): return authenticate()

@app.route('/')
def index():
    """Display website and ensure the upload folder is updated."""
    return render_template('upload.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload by writing each chunk of data on each request."""

    #here is some heavy input validation
    folder = os.path.normpath(request.form.get('folder',''))
    if not isinstance(folder, str):
        return {'message': 'Invalid folder'}, 400

    if 'file' not in request.files:
        return {'message': 'No file part'}, 400
    file = request.files['file']

    filename = file.filename
    if not isinstance(filename, str):
        return {'message': 'Invalid file name'}, 400

    file_content = file.read()
    chunk_size = len(file_content)
    if chunk_size == 0:
        return {'message': 'Empty file'}, 400

    chunk_index = 0
    try:
        chunk_index = int(request.form.get('chunk'))
    except (ValueError, TypeError):
        return {'message': 'Invalid chunk index'}, 400

    file_size = 0
    try:
        file_size = int(request.form.get('fileSize'))
        if file_size <= 0:
            return {'message': 'Empty file'}, 400
    except (ValueError, TypeError):
        return {'message': 'Invalid file size'}, 400

    resume = request.form.get('resume','false')
    if not isinstance(resume, str):
        return {'message': 'Invalid resume option'}, 400

    total_chunks = math.ceil(file_size/EXPECTED_CHUNK_SIZE)


    #check if the uploaded chunk is valid in size
    if (chunk_size != EXPECTED_CHUNK_SIZE) and (chunk_index+1 != total_chunks):
        # if not the last chunk and chunk_size=EXPECTED_CHUNK_SIZE
        return {'message': 'Chunk is likely corruputed', 'code': 'CORRUPTED'}, 400
    elif ((file_size-((total_chunks-1)*EXPECTED_CHUNK_SIZE) != chunk_size) and
        (chunk_index+1 == total_chunks)): 
        # if it is the last chunk and it doesn't match the ending chunk.
        return {'message': 'Chunk is likely corruputed', 'code': 'CORRUPTED'}, 400


    # Ensure the folder exists
    folder_path = os.path.join(UPLOAD_FOLDER, secure_folderpath(UPLOAD_FOLDER,folder))
    os.makedirs(folder_path, exist_ok=True)
    file_path = os.path.join(folder_path, secure_filename(filename))

    if os.path.exists(file_path):
        if (file_size == os.path.getsize(file_path)) and resume=="true":
            return {'message':'File already uploaded', 'code': 'FILE_ALREADY_UPLOADED'}, 200

        if os.path.getsize(file_path) > EXPECTED_CHUNK_SIZE*chunk_index:
            # Request to resume to a specific index when resume is toggled
            if resume=="true":
                resumeTo = str(os.path.getsize(file_path)/EXPECTED_CHUNK_SIZE)
                return {'message': f'Skipping this chunk. Resume to chunk {resumeTo}', 'code': 'RESUME_UPLOAD', 'resumeChunk': resumeTo}, 200
            else:
                # Rewrite the file
                resumeTo = 0
                os.remove(file_path)
                return {'message': f'Skipping this chunk. Resume to chunk {resumeTo}', 'code': 'RESUME_UPLOAD', 'resumeChunk': resumeTo}, 200



    #print("Writing chunk ", chunk_index+1)

    # Append the chunk to the file
    with open(file_path, 'ab') as f:
        f.write(file_content)

    if chunk_index + 1 == total_chunks:
        return {'message': 'File uploaded successfully', 'code': 'SUCCESS'}, 200

    return {'message': 'Chunk recieved', 'code': 'CONTINUE'}, 200



@app.route('/download/<path:inputPath>', methods=['GET'])
def download_file(inputPath):
    """Handle file downloads."""
    return send_from_directory(UPLOAD_FOLDER, inputPath, as_attachment=False)


@app.route('/zip/', defaults={'inputPath': ''}, methods=['GET'])
@app.route('/zip/<path:inputPath>', methods=['GET'])
def download_zip(inputPath):
    """Download an entire directory by downloading a zip file on the fly"""
    folder_path = os.path.join(UPLOAD_FOLDER, secure_folderpath(UPLOAD_FOLDER,os.path.normpath(inputPath)))
    seen_links = set()
    if not os.path.exists(folder_path):
        return {'message', 'Path not found'}, 404
    if os.path.isfile(folder_path):
        paths = [{'fs': folder_path, 'n': os.path.basename(folder_path)}]
    elif os.path.isdir(folder_path):
        paths = []
        for root, dirs, files in os.walk(folder_path, followlinks=True):
            for file in files:
                file_path = os.path.join(root, file)
                paths.append({
                    'fs': file_path,
                    'n': os.path.relpath(file_path, folder_path)
                })
            for dir in dirs:
                if os.path.islink(dir):
                    if dir in seen_links:
                        break
                seen_links.add(dir)
            else:
                continue
            break
    else:
        return {'message': 'Path is not directory or file.'}, 404


    zfly = zipfly.ZipFly( paths=paths )

    z = zfly.generator()

    response = Response(z, mimetype='application/zip')
    response.headers['Content-Disposition'] = 'attachment; filename=archive.zip'
    return response


@app.route('/files', methods=['GET'])
def list_files():
    """
    Create a json of files and folders relative to the upload folder.

    The function returns a json containing:
    - 'files': An array of relative paths to the files found
    - 'folders': An array of relative paths to the subdirectories found

    :return: A json with keys 'files' and 'folders'.
    """
    folder = os.path.normpath(request.args.get('folder', ''))
    seen_links = set() # to detect symlink loops.
    file_list = []
    folder_list = []
    if folder:
        # List all files in the selected directory
        folder_path = os.path.join(UPLOAD_FOLDER, secure_folderpath(UPLOAD_FOLDER, folder))
    else:
        # List all files in the upload directory if no folder is specified
        folder_path = UPLOAD_FOLDER

    if os.path.exists(folder_path):
        # we use symbolic links to link multiple folder paths
        for root, dirs, files in os.walk(folder_path,followlinks=True):
            for file in files:
                relative_path = os.path.relpath(os.path.join(root, file), folder_path)
                file_list.append(relative_path)
            for dir in dirs:
                if os.path.islink(dir):
                    if dir in seen_links:
                        break
                    seen_links.add(dir)

                relative_path = os.path.relpath(os.path.join(root, dir), folder_path)
                folder_list.append(relative_path)
            else:
                continue # if the inner loop didn't break, continue
            break

    return {'files': file_list, 'folders': folder_list}


@app.route('/delete', methods=['POST'])
def delete_item():
    """
    Deletes a file/directory

    :return: A json response with a message if the operation was successful or not.
    """
    inputPath = os.path.normpath(request.form.get('path',''))

    if not isinstance(inputPath, str) or not inputPath:
        return {'message': 'Invalid path. Do not delete root.'}, 400

    file_path = os.path.join(UPLOAD_FOLDER, secure_folderpath(UPLOAD_FOLDER, inputPath))

    if file_path == UPLOAD_FOLDER:
        return {'message': 'You cannot delete the root directory.'}, 400
    if not os.path.exists(file_path):
        return {'message': 'File/folder not found'}, 404
    if os.path.isfile(file_path):
        os.remove(file_path)
    elif os.path.isdir(file_path):
        try:
            shutil.rmtree(file_path)
        except Exception as e:
            print(f'Delete error: {e}')
            return {'message': 'An unexpected error occurred'}, 405
        
    return {'message': 'Deleted'}, 200

@app.route('/move', methods=['POST'])
def move_item():
    """
    Move a file/directory

    :return: A json response with a message if the operation was successful or not.
    """
    sourcePath = os.path.normpath(request.form.get('sourcePath',''));
    destinationPath = os.path.normpath(request.form.get('destinationPath'));

    if not isinstance(sourcePath, str) or not sourcePath:
        return {'message': 'Invalid path'}, 400
    if not isinstance(destinationPath, str) or not destinationPath:
        # assume user wants to move to root folder
        destinationPath = ''

    sourcePath = os.path.join(UPLOAD_FOLDER, secure_folderpath(UPLOAD_FOLDER, sourcePath))
    destinationPath = os.path.join(UPLOAD_FOLDER, secure_folderpath(UPLOAD_FOLDER, destinationPath))

    if not os.path.exists(sourcePath):
        return {'message': 'File/folder not found'}, 404

    try:
        shutil.move(sourcePath, destinationPath)
        return {'message': 'Moved'}, 200
    except FileNotFoundError:
        return {'message': 'Path does not exist. Check if you enter the correct path'}, 400
    except Exception as e:
        print(f'Move error: {e}')
        return {'message': 'An unexpected error occurred'}, 405


@app.route('/newfile', methods=['POST'])
def new_file():
    """
    Create a new file

    :return: A json response with a message if the operation was successful or not.
    """
    inputFilename = os.path.normpath(request.form.get('filename',''));

    if (not isinstance(inputFilename, str) or not inputFilename):
        return {'message': 'Invalid file name'}, 400

    filename = os.path.join(UPLOAD_FOLDER, secure_folderpath(UPLOAD_FOLDER, inputFilename))
    directory = secure_folderpath(UPLOAD_FOLDER,os.path.dirname(filename))

    try:
        os.makedirs(directory,exist_ok=True)
        with open(filename, 'x') as file:
            pass
        return {'message': 'File created'}, 200
    except FileExistsError:
        return {'message': 'The path you gave already exists.'}, 400
    except Exception as e:
        print(f"New file error: {e}")
        return {'message': "An unexpected error occurred"}, 405


@app.route('/newfolder', methods=['POST'])
def new_folder():
    """
    Create a new directory

    :return: A json response with a message if the operation was successful or not.
    """
    inputFoldername = os.path.normpath(request.form.get('foldername',''));

    if (not isinstance(inputFoldername, str) or not inputFoldername):
        return {'message': 'Invalid folder name'}, 400

    foldername = os.path.join(UPLOAD_FOLDER, secure_folderpath(UPLOAD_FOLDER, inputFoldername))

    try:
        os.makedirs(foldername,exist_ok=True)
        return {'message': 'Folder created'}, 200
    except FileExistsError:
        return {'message': 'The path you gave already exists.'}, 400
    except Exception as e:
        print(f"New folder error: {e}")
        return {'message': "An unexpected error occurred"}, 405


# setup some global variables and configurations for ease of use.
TOKEN = qrFileServerConfig.token
USERS = qrFileServerConfig.users 
URLS = qrFileServerConfig.urls 
TEMPDIR = tempfile.mkdtemp()
UPLOAD_FOLDER = setup_upload_paths(os.getenv('QR_FILE_SERVER_INPUT'))
READONLY = qrFileServerConfig.readonly
EXPECTED_CHUNK_SIZE = 1000*500 # if you want to change this, the js file needs changing also

#flask writes temp files to disk when upload size are over 500KiB so this should cap it.
app.config['MAX_CONTENT_LENGTH'] = 1024*500 

atexit.register(cleanup)



print(f"Readonly: {READONLY}")
print(f"Upload folder set to {UPLOAD_FOLDER}")
for url in URLS:
    print(f"Accessible on {url}")
    print(generate_unicode_qr(url))
