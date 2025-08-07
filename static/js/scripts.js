// Fetch and display the list of files based on selected folder
document.getElementById('selected-folder').addEventListener('change', updateUI);
// Initially update the UI on start
document.addEventListener('DOMContentLoaded', updateUI);

const token = getTokenFromUrl();
if (token) {
    setCookie('token', token, 7);
}




///////////////////////////////Helper functions/////////////////////////////////////////

// Helper function of copyTokenQueryString to get the token from the current URL.
function getTokenFromUrl() {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    return params.get('token'); // Returns the part of the url with the 'token' parameter
}

// Copy the token argument from the current URL to pass it on to other urls
function copyTokenQueryString() {
    const token = getTokenFromUrl();
    if (token) {
        return `token=${token}`;
    } else {
        return '';
    }
}

// Reset progress bar
function resetBar() {
    document.getElementById('progress-bar').value = 0;
    document.getElementById('progress-text').innerText = '';
    document.getElementById('progress-container').style.display = 'none';
}

function setProgressbar(percentComplete, filesLeft) {
    // Show the progress bar
    document.getElementById('progress-container').style.display = 'block';
    document.getElementById('progress-bar').value = percentComplete;
    document.getElementById('progress-text').innerText = Math.round(percentComplete) + '% uploaded. ' + filesLeft + ' more files left';
}


function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

function dirname(filepath) {
    filepath = normalizePath(filepath)

    const index = filepath.lastIndexOf('/');
    if (index === -1) {
        return '';
    }
    return filepath.substring(0, index);
}

function joinPaths(paths) {
    let joinedSegments = [];
    for (let i=0;i<paths.length;i++) {
        joinedSegments = [...joinedSegments, ...paths[i].split('/')];
    }
    // Normalize the joined path
    return normalizePath(joinedSegments.join('/'));
}

function normalizePath(rawPath) {
    const segments = rawPath.split('/');
    const normalizedSegments = [];

    for (let i=0;i<segments.length;i++) {
        let segment = segments[i];
        if (segment === '' || segment === '.') {
            continue; //skip empty or .
        } else if (segment === '..') {
            if (normalizedSegments.length > 0) {
                normalizedSegments.pop();
            }
        } else {
            normalizedSegments.push(segment);
        }
    }

    return normalizedSegments.join('/');
}


/////////////////////////////Handle uploading//////////////////////////////////////
document.getElementById('uploadform').addEventListener('submit', (event) => {
    event.preventDefault(); // Prevent the default form submission

    uploadFileRecursive(
        Array.from(document.getElementById('fileInput').files),
        document.getElementById('selected-folder').value,
        document.getElementById('resume').checked
    );

});

function updateOptions(folderOptions, data) {
    // update folder search options
    // fetch and populate the folder dropdown
    folderOptions.innerHTML = ''; // clear previous list
    data.folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        option.textContent = folder;
        folderOptions.appendChild(option);
    });
}


// Recursively upload files
function uploadFileRecursive(fileArray, folder, resume) {
    if (fileArray.length == 0) {
        alert("All uploads complete");
        updateUI();
        resetBar();
        return;
    }
    file = fileArray.pop();
    const chunkSize = 1000 * 500;
    const token = copyTokenQueryString();
    const totalChunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    
    
    //recursively upload file chunks
    const uploadChunk = (start) => {
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const formData = new FormData();
        formData.append('file', chunk, file.name);
        formData.append('folder', folder);
        formData.append('chunk', currentChunk);
        formData.append('fileSize', file.size);
        formData.append('resume', resume.checked);
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/upload?${token}`, true);

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                setProgressbar(((currentChunk + 1) / totalChunks) * 100, fileArray.length);
            }
        });

        xhr.onload = () => {
            let response;
            try {
                response = JSON.parse(xhr.responseText);
            } catch (e) {
                alert(xhr.responseText); //something seriously gone wrong server side
                return;
            }
            if (xhr.status === 200) {
                if (response.code == "RESUME_UPLOAD") { //server asking to resume to specific index
                    console.log(response.message);
                    currentChunk = Number(response.resumeChunk);
                    uploadChunk(currentChunk * chunkSize);
                    return;
                } else if (response.code == "FILE_ALREADY_UPLOADED") {
                    console.log(response.message);
                    uploadFileRecursive(fileArray, folder, resume);
                    return;
                }
                currentChunk++;
                console.log("Uploading chunk " + currentChunk);
                if (currentChunk < totalChunks) {
                    uploadChunk(start + chunkSize); // Upload the next chunk
                } else {
                    console.log('Upload successful!');
                    uploadFileRecursive(fileArray, folder, resume);
                }
            } else {
                alert('Upload failed: ' + response.message);
                resetBar();
            }
        };

        xhr.onerror = () => {
            alert("Network error occurred during the upload.");
            resetBar();
        };

        xhr.onabort = () => {
            alert("Upload aborted.");
            resetBar();
        };

        xhr.send(formData);
    };

    uploadChunk(0); // Start uploading the first chunk
}



////////////////////////////////Handling directory tree////////////////////////////////////
/**
 * Update the directory tree and folder dropdown listings
 */
function updateUI() {
    const token = copyTokenQueryString();
    const selectedFolder = document.getElementById('selected-folder').value;
    const fileListContainer = document.getElementById('file-list');
    const folderOptions = document.getElementById('folderlist');
    fileListContainer.innerHTML = '';
    
    
    //update the zip download directory
    document.getElementById('zip').href = `/zip/${selectedFolder}?${token}`;


    // fetches the files data to build and render the file tree. Also update folder options
    fetch(`/files?${token}&folder=${encodeURIComponent(selectedFolder)}`)
        .then(response => response.json())
        .then(data => {
            const folders = data.folders; // e.g. ['', 'a', 'a/b', ...]
            const files = data.files; // e.g. ['a/b/foo.txt', 'a/bar.txt', ...]
            const root = buildTree(folders, files);
            renderTree(root, fileListContainer);
            
            updateOptions(folderOptions, data);
        });

    /**
     * Build a nested tree structure based on an array of folderPaths and filePaths
     * @param {string[]} folderPaths - An array of folder path strings from some directory.
     * @param {string[]} filePaths - An array of file path strings from some directory
     * @return {Node} The root node object of this tree.
     */
    function buildTree(folderPaths, filePaths) {
        function Node(name, path) {
            this.name = name; // folder name of this node
            this.path = path; // folder path to this node.
            this.folders = {}; // the nested folder nodes in this folder node
            this.files = []; // array of {file_name:path} in this folder node
        }

        const root = new Node('', selectedFolder); // root node represents UPLOAD_FOLDER

        // populate nodes for each folder
        folderPaths.forEach(path => {
            //split and remove empty paths so "folder1/folder2" -> ["folder1", "folder2"]
            const parts = path.split('/').filter(p => p.length);
            let current = root;
            let currentPath = root.path;
            parts.forEach(part => { // ["folder1", "folder2"] -> folder1 -> folder2 -> folder3
                if (!current.folders[part]) {
                    current.folders[part] = new Node(part, currentPath);
                }
                currentPath = joinPaths([currentPath,part]);
                current = current.folders[part]; //kinda cd into next level
            });
        });

        // populate files
        filePaths.forEach(path => {
            const parts = path.split('/').filter(p => p.length);
            const fileName = parts.pop();
            let current = root;
            let currentPath = root.path;
            parts.forEach(part => { //traverse through folder nodes
                if (!current.folders[part]) {
                    // in case folder wasn't in the folders list, create it anyway
                    current.folders[part] = new Node(part, currentPath);
                }
                currentPath = joinPaths([currentPath,part]);
                current = current.folders[part];
            });
            // add the file
            current.files.push({name: fileName, path});
        });

        return root;
    }

    /**
     * Build the html elements based on the rootNode from buildTree()
     * @param {Node} rootNode - The root node object of a tree.
     * @param {HTMLElement} container - The element that will contained the rendered tree.
     */
    function renderTree(rootNode, container) {
        rootElement = renderNode(rootNode,rootNode);
        rootElement.open = true;
        container.appendChild(rootElement,rootElement);
        rootElement.querySelector('summary').nodeValue = selectedFolder;
    }

    /**
     * Helper function of renderTree to build the html elements.
     * @param {Node} node - The current node object of a tree.
     */
    function renderNode(node, rootNode) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        const deleteBtn = document.createElement('button');
        const renameBtn = document.createElement('button');
        const newFileBtn = document.createElement('button');
        const newFolderBtn = document.createElement('button');
        const moveBtn = document.createElement('button');
        if (rootNode == node) {
            // while the root node technically and shouldn't have a name,
            // I will give it this relative path to make it useful.
            summary.textContent = rootNode.path
        } else {
            summary.textContent = node.name;
        }
        
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => {
            deletePath(node.path, node.name);
        }

        renameBtn.textContent = 'Rename';
        renameBtn.onclick = () => {
            movePathUI(node.path, node.name, node.path, node.name);
        };

        moveBtn.textContent = 'Move';
        moveBtn.onclick = () => {
            movePathUI(node.path, node.name, '',joinPaths([node.path, node.name]));
        };

        
        newFileBtn.textContent = 'New File';
        newFileBtn.onclick = () => {
            newItemUI(joinPaths([node.path, node.name]),'File')
        };


        newFolderBtn.textContent = 'New Folder';
        newFolderBtn.onclick = () => {
            newItemUI(joinPaths([node.path, node.name]),'Folder')
        };



        // classes
        deleteBtn.classList.add('folder-container');
        deleteBtn.classList.add('border');

        renameBtn.classList.add('folder-container');
        renameBtn.classList.add('border');

        moveBtn.classList.add('folder-container');
        moveBtn.classList.add('border');  
        
        newFileBtn.classList.add('folder-container');
        newFileBtn.classList.add('border');

        newFolderBtn.classList.add('folder-container');
        newFolderBtn.classList.add('border');

        summary.classList.add('folder-container');
        summary.classList.add('border');

        details.classList.add('folder-container');
        details.classList.add('border');


        summary.appendChild(deleteBtn);
        summary.appendChild(renameBtn);
        summary.appendChild(moveBtn);
        summary.appendChild(newFileBtn);
        summary.appendChild(newFolderBtn);
        details.appendChild(summary);

        // recurse into subfolders
        Object.values(node.folders).forEach(folderNode => {
            details.appendChild(renderNode(folderNode,rootNode));
        });

        // render files in this folder
        node.files.forEach(file => {
            const fileDiv = document.createElement('div');
            const a = document.createElement('a');
            const editBtn = document.createElement('button');
            const deleteBtn = document.createElement('button');
            const renameBtn = document.createElement('button');
            const moveBtn = document.createElement('button');
            a.textContent = file.name;
            a.href = `${joinPaths(['download',selectedFolder,file.path])}?${token}`;

            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => {
                deletePath(selectedFolder, file.path);
            }

            editBtn.textContent = 'Edit';
            editBtn.onclick = () => {
                editFile(selectedFolder, file.path, file.name);
            };
            
            renameBtn.textContent = 'Rename';
            renameBtn.onclick = () => {
                movePathUI(selectedFolder, file.path, joinPaths([node.path,node.name]), file.name);
            };

            moveBtn.textContent = 'Move';
            moveBtn.onclick = () => {
                movePathUI(selectedFolder, file.path, '', joinPaths([node.path,node.name,file.name]));
            };
            


            // classes
            a.classList.add('file-container');

            deleteBtn.classList.add('file-container');
            deleteBtn.classList.add('border');

            editBtn.classList.add('file-container');
            editBtn.classList.add('border');

            renameBtn.classList.add('file-container');
            renameBtn.classList.add('border');

            moveBtn.classList.add('file-container');
            moveBtn.classList.add('border');

            fileDiv.classList.add('file-container');
            fileDiv.classList.add('file-tree');
            fileDiv.classList.add('border');


            fileDiv.appendChild(a);
            fileDiv.appendChild(deleteBtn)
            fileDiv.appendChild(editBtn);
            fileDiv.appendChild(renameBtn);
            fileDiv.appendChild(moveBtn);
            details.appendChild(fileDiv);
        });

        return details;
    }
}










///////////////////////////////////File Management Tools////////////////////////////

/**
 * Fetches a given file and call editFileUI to bring the editor.
 * @param {string} selectedFolder - A path to a selected folder. Should be from the #selected-folder element.
 * @param {string} filepath - A relative path between selectedFolder to the a specific file.
 */
function editFile(selectedFolder, filepath, filename) {
    const token = copyTokenQueryString();
    const url = `${joinPaths(['download',selectedFolder,filepath])}?${token}`

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network Error: ' + response.statusText);
            }
            
            const contentLength = response.headers.get('Content-Length');
            if (contentLength && parseInt(contentLength) > 1024 * 1000) {
                throw new Error('File size exceeds 1 MiB.');
            }
            return response.text();
        })
        .then(data => {
            editFileUI(selectedFolder, filepath, filename, data);
        })
        .catch(error => {
            alert(error);
        });
}



/**
 * Send a request to delete a file/directory.
 * @param {string} directory - The base directory of the filename/directoryname to be deleted.
 * @param {string} filename - The name of the file/directory to be deleted.
 */
function deletePath(directory, filename) {
    const token = copyTokenQueryString();
    const url = `/delete?${token}`;
    const path = joinPaths([directory,filename]);

    const formData = new FormData();
    formData.append('path', path);
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.onload = () => {
        let response;
        try {
            response = JSON.parse(xhr.responseText);
        } catch (e) {
            alert(xhr.responseText);
            return;
        }
        if (xhr.status === 200) {
            alert(response.message);
            updateUI();
        } else {
            alert('Delete failed: ' + response.message);
        }
    }
    xhr.onerror = () => {
        alert("Network error occurred while trying to deleting.");
    };

    xhr.onabort = () => {
        alert("Delete aborted.");
    };

    xhr.send(formData);
}



/**
 * Send a request to move a file/directory.
 * @param {string} sourceDirectory - The source base directory of the filename/directoryname to be moved.
 * @param {string} sourceFilename - The source name of the file/directory to be moved.
 * @param {string} destinationDirectory - The destination base directory of the filename/directoryname to be moved.
 * @param {string} destinationFilename - The destination name of the file/directory to be moved.
 */
function movePath(sourceDirectory, sourceFilename, destinationDirectory, destinationFilename) {
    const token = copyTokenQueryString();
    const url = `/move?${token}`;
    const sourcePath = joinPaths([sourceDirectory,sourceFilename]);
    const destinationPath = joinPaths([destinationDirectory,destinationFilename]);

    const formData = new FormData();
    formData.append('sourcePath', sourcePath);
    formData.append('destinationPath', destinationPath);
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.onload = () => {
        let response;
        try {
            response = JSON.parse(xhr.responseText);
        } catch (e) {
            alert(xhr.responseText);
            return;
        }
        if (xhr.status === 200) {
            alert(response.message);
            updateUI();
        } else {
            alert('Move failed: ' + response.message);
        }
    }
    xhr.onerror = () => {
        alert("Network error occurred while trying to move.");
    };

    xhr.onabort = () => {
        alert("Move aborted.");
    };

    xhr.send(formData);
}


/**
 * Send a request to create a new file.
 * @param {string} directory - The base directory of the filename to be created.
 * @param {string} filename - The name of the file to be created.
 */
function newFile(directory, filename) {
    const token = copyTokenQueryString();
    const url = `/newfile?${token}`;

    const formData = new FormData();
    formData.append('filename', joinPaths([directory, filename]));
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.onload = () => {
        let response;
        try {
            response = JSON.parse(xhr.responseText);
        } catch (e) {
            alert(xhr.responseText);
            return;
        }
        if (xhr.status === 200) {
            alert(response.message);
            updateUI();
        } else {
            alert('Creating new file failed: ' + response.message);
        }
    }
    xhr.onerror = () => {
        alert("Network error occurred while trying to make a new file.");
    };

    xhr.onabort = () => {
        alert("Creating new file aborted.");
    };

    xhr.send(formData);
}


/**
 * Send a request to create a new directory.
 * @param {string} directory - The base directory of the directoryname to be created.
 * @param {string} foldername - The name of the directory to be created.
 */
function newFolder(directory, foldername) {
    const token = copyTokenQueryString();
    const url = `/newfolder?${token}`;
    console.log(foldername)

    const formData = new FormData();
    formData.append('foldername', joinPaths([directory, foldername]));
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.onload = () => {
        let response;
        try {
            response = JSON.parse(xhr.responseText);
        } catch (e) {
            alert(xhr.responseText);
            return;
        }
        if (xhr.status === 200) {
            alert(response.message);
            updateUI();
        } else {
            alert('Creating new file failed: ' + response.message);
        }
    }
    xhr.onerror = () => {
        alert("Network error occurred while trying to make a new folder.");
    };

    xhr.onabort = () => {
        alert("Creating new folder aborted.");
    };

    xhr.send(formData);
}


/////////////////////////////////File Management Tools UI//////////////////////////////////////

/**
 * Generates the html overlay text editor.
 * @param {string} selectedFolder - A path to a selected folder. Should be from the #selected-folder element.
 * @param {string} filepath - A relative path between selectedFolder to the a specific file.
 * @param {string} filename - The filename of the file being edited in filepath.
 */
function editFileUI(selectedFolder, filepath, filename, data) {
    const overlay = document.createElement('div');
    const header = document.createElement('h2');
    const textarea = document.createElement('textarea');
    const buttonDiv = document.createElement('div');
    const exitBtn = document.createElement('button');
    const saveBtn = document.createElement('button');
    overlay.classList.add('overlay');

    header.textContent = 'File Editor';

    textarea.value = data;
    textarea.classList.add('editor');


    exitBtn.classList.add('UI-button');
    exitBtn.textContent = 'Exit';
    exitBtn.onclick = () => {
        document.body.removeChild(overlay);
    };

    saveBtn.classList.add('UI-button');
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => {
        const blob = new Blob([textarea.value]);
        const file = new File([blob], filename);
        uploadFileRecursive([file], dirname(joinPaths([selectedFolder,filepath])), 'false'); 
        document.body.appendChild(overlay);
    };

    buttonDiv.appendChild(saveBtn);
    buttonDiv.appendChild(exitBtn);

    overlay.appendChild(header);
    overlay.appendChild(textarea);
    overlay.appendChild(buttonDiv);

    document.body.appendChild(overlay);

    //close the overlay when clicking outside
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}


/**
 * Generates the html overlay to move files/directories.
 * @param {string} sourceDirectory - The source base directory of the filename/directoryname to be moved.
 * @param {string} sourceFilename - The source name of the file/directory to be moved.
 * @param {string} destinationDirectory - The destination base directory of the filename/directoryname to be moved.
 * @param {string} destinationFilename - The destination name of the file/directory to be moved.
 */
function movePathUI(sourceDirectory, sourceFilename, destinationPath, destinationFilename) {
    const overlay = document.createElement('div');
    const moveContainer = document.createElement('div');
    const header = document.createElement('h2');
    const destinationPathInputLabel = document.createElement('label');
    const destinationPathInput = document.createElement('input');
    const datalist = document.createElement('datalist');
    const submitBtn = document.createElement('button');
    const exitBtn = document.createElement('button');
    destinationPathInput.type = 'text';
    
    header.textContent = 'Move/Rename Files or Directories';
    
    destinationPathInputLabel.textContent = `Move ${joinPaths([sourceDirectory,sourceFilename])} to ${destinationPath}`;
    destinationPathInput.placeholder = '/path/to/directory or /path/to/directory/newname';
    destinationPathInput.value = destinationFilename.replace(/\/+/g, '/');
    destinationPathInput.classList.add('UI-input');
    destinationPathInput.setAttribute('list', 'movePath-datalist');
    datalist.setAttribute('id', 'movePath-datalist');

    fetch(`/files?${token}&folder=${encodeURIComponent('/')}`)
        .then(response => response.json())
        .then(data => {
            updateOptions(datalist, data);
        });

    submitBtn.classList.add('UI-button');
    submitBtn.textContent = 'Submit';
    submitBtn.onclick = () => {
        movePath(sourceDirectory, sourceFilename, destinationPath, destinationPathInput.value);
        document.body.removeChild(overlay);
    };

    exitBtn.classList.add('UI-button');
    exitBtn.textContent = 'Exit';
    exitBtn.onclick = () => {
        document.body.removeChild(overlay);
    };

    overlay.className = 'overlay';
    moveContainer.className = 'UI-container';

    moveContainer.appendChild(header);
    moveContainer.appendChild(destinationPathInputLabel);
    moveContainer.appendChild(destinationPathInput);
    moveContainer.appendChild(datalist);
    moveContainer.appendChild(submitBtn);
    moveContainer.appendChild(exitBtn);
    overlay.appendChild(moveContainer);

    document.body.appendChild(overlay);

    //close the overlay when clicking outside
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}





/**
 * Generate a html overlay that creates a new file/directory.
 * @param {string} directory - The path to the new file/directory to be created
 * @param {string} type - The type of item to be created. ('File' or 'Folder')
 */
function newItemUI(directory,type) {
    const overlay = document.createElement('div');
    const newItemContainer = document.createElement('div');
    const header = document.createElement('h2');
    const pathLabel = document.createElement('label');
    const path = document.createElement('input');
    const datalist = document.createElement('datalist');
    const submitBtn = document.createElement('button');
    const exitBtn = document.createElement('button');
    path.type = 'text';
    
    header.textContent = `New ${type}`;
    
    pathLabel.textContent = `Enter a ${type} name: `;
    path.classList.add('UI-input');
    path.setAttribute('list', 'newItem-datalist');
    datalist.setAttribute('id', 'newItem-datalist');

    fetch(`/files?${token}&folder=${encodeURIComponent('/')}`)
        .then(response => response.json())
        .then(data => {
            updateOptions(datalist, data);
        });

    submitBtn.classList.add('UI-button');
    submitBtn.textContent = 'Submit';
    submitBtn.onclick = () => {
        if (type === 'Folder') {
            newFolder(directory,path.value);
        } else {
            newFile(directory, path.value);
        }
        document.body.removeChild(overlay);
    };

    exitBtn.classList.add('UI-button');
    exitBtn.textContent = 'Exit';
    exitBtn.onclick = () => {
        document.body.removeChild(overlay);
    };

    overlay.className = 'overlay';
    newItemContainer.className = 'UI-container';

    newItemContainer.appendChild(header);
    newItemContainer.appendChild(pathLabel);
    newItemContainer.appendChild(path);
    newItemContainer.appendChild(datalist);
    newItemContainer.appendChild(submitBtn);
    newItemContainer.appendChild(exitBtn);
    overlay.appendChild(newItemContainer);

    document.body.appendChild(overlay);

    //close the overlay when clicking outside
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}
