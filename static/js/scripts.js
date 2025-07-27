// Fetch and display the list of files based on selected folder
document.getElementById('folder').addEventListener('change', updateUI);
// Initially update the UI on start
document.addEventListener('DOMContentLoaded', updateUI);

const token = getTokenFromUrl()
if (token) {
    setCookie('token', token, 7)
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
    const token = getTokenFromUrl()
    if (token) {
        return `token=${token}`
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

function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}


/////////////////////////////Handle uploading//////////////////////////////////////
document.getElementById('uploadform').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the default form submission

    const folder = document.getElementById('folder').value;
    const files = document.getElementById('fileInput').files;
    const chunkSize = 1000 * 500;

    const progressBar = document.getElementById('progress-bar')
    const progressText = document.getElementById('progress-text')
    const resume = document.getElementById('resume')

    // Show the progress bar
    document.getElementById('progress-container').style.display = 'block';
    processFileRecursive(Array.from(files))

    // Recursively upload files
    function processFileRecursive(fileArray) {
        if (fileArray.length == 0) {
            alert("All uploads complete")
            updateUI()
            resetBar()
            return
        }
        file = fileArray.pop()
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
            formData.append('resume', resume.checked)
            
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `/upload?${token}`, true);

            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    const percentComplete = ((currentChunk + 1) / totalChunks) * 100;
                    progressBar.value = percentComplete;
                    progressText.innerText = Math.round(percentComplete) + '% uploaded. ' + fileArray.length + ' more files left';
                }
            });

            xhr.onload = function() {
                let response;
                try {
                    response = JSON.parse(xhr.responseText);
                } catch (e) {
                    alert(xhr.responseText); //something seriously gone wrong server side
                    return
                }
                if (xhr.status === 200) {
                    if (response.code == "RESUME_UPLOAD") { //server asking to resume to specific index
                        console.log(response.message)
                        currentChunk = Number(response.resumeChunk)
                        uploadChunk(currentChunk * chunkSize)
                        return
                    } else if (response.code == "FILE_ALREADY_UPLOADED") {
                        console.log(response.message)
                        processFileRecursive(fileArray)
                        return
                    }
                    currentChunk++;
                    console.log("Uploading chunk " + currentChunk)
                    if (currentChunk < totalChunks) {
                        uploadChunk(start + chunkSize); // Upload the next chunk
                    } else {
                        console.log('Upload successful!');
                        processFileRecursive(fileArray)
                    }
                } else {
                    alert('Upload failed: ' + response.message);
                    resetBar()
                }
            };

            xhr.onerror = function() {
                alert("Network error occurred during the upload.")
                resetBar()
            };

            xhr.onabort = function() {
                alert("Upload aborted.")
                resetBar()
            };

            xhr.send(formData);
        };

        uploadChunk(0); // Start uploading the first chunk
    }
});



////////////////////////////////Handling directory tree////////////////////////////////////
/**
 * Update the directory tree and folder dropdown listings
 */
function updateUI() {
    const token = copyTokenQueryString();
    const folderSelect = document.getElementById('folderlist');
    const selectedFolder = document.getElementById('folder').value;
    const fileListContainer = document.getElementById('file-list');
    fileListContainer.innerHTML = '';
    
    
    //update the zip download directory
    document.getElementById('zip').href = `/zip/${selectedFolder}?${token}`


    // fetches the files data to build and render the file tree. Also update folder options
    fetch(`/files?${token}&folder=${encodeURIComponent(selectedFolder)}`)
        .then(response => response.json())
        .then(data => {
            const folders = data.folders; // e.g. ['', 'a', 'a/b', ...]
            const files = data.files; // e.g. ['a/b/foo.txt', 'a/bar.txt', ...]
            const root = buildTree(folders, files);
            renderTree(root, fileListContainer);
            
            // update folder search options
            // fetch and populate the folder dropdown
            folderSelect.innerHTML = ''; // clear previous list
            data.folders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder;
                option.textContent = folder;
                folderSelect.appendChild(option);
            });
        });

    /**
     * Build a nested tree structure based on an array of folderPaths and filePaths
     * @param {string[]} folderPaths - An array of folder path strings from some directory.
     * @param {string[]} filePaths - An array of file path strings from some directory
     * @return {Node} The root node object of this tree.
     */
    function buildTree(folderPaths, filePaths) {
        function Node(name) {
            this.name = name; // folder name of this node
            this.folders = {}; // the nested folder nodes in this folder node
            this.files = []; // array of {file_name:path} in this folder node
        }

        const root = new Node(''); // root node represents UPLOAD_FOLDER

        // populate nodes for each folder
        folderPaths.forEach(path => {
            //split and remove empty paths so "folder1/folder2" -> ["folder1", "folder2"]
            const parts = path.split('/').filter(p => p.length);
            let current = root;
            parts.forEach(part => { // ["folder1", "folder2"] -> folder1 -> folder2 -> folder3
                if (!current.folders[part]) {
                    current.folders[part] = new Node(part);
                }
                current = current.folders[part]; //kinda cd into next level
            });
        });

        // populate files
        filePaths.forEach(path => {
            const parts = path.split('/').filter(p => p.length);
            const fileName = parts.pop();
            let current = root;
            parts.forEach(part => { //traverse through folder nodes
                if (!current.folders[part]) {
                    // in case folder wasn't in the folders list, create it anyway
                    current.folders[part] = new Node(part);
                }
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
        rootNode.name = "/"+selectedFolder
        rootElement = renderNode(rootNode)
        rootElement.open = true;
        container.appendChild(rootElement);
    }

    /**
     * Helper function of renderTree to build the html elements.
     * @param {Node} node - The current node object of a tree.
     */
    function renderNode(node) {
        const details = document.createElement('details');
        details.classList.add('file-tree');
        const summary = document.createElement('summary');
        summary.classList.add('file-tree');
        summary.textContent = node.name;
        details.appendChild(summary);

        // recurse into subfolders
        Object.values(node.folders).forEach(folderNode => {
            details.appendChild(renderNode(folderNode));
        });

        // render files in this folder
        node.files.forEach(file => {
            const a = document.createElement('a');
            a.textContent = file.name;
            a.href = `/download/${selectedFolder}/${file.path}?${token}`;
            a.classList.add('file');
            details.appendChild(a);
        });

        return details;
    }
}

