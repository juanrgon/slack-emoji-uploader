/**
* Attempt to save the input teams to chrome.storage.sync
*/
const saveTeams = () => {
    const teamsDiv = document.getElementById('teams');
    const teams = [];
    var teamInputs = teamsDiv.children;
    const teamStatuses: Array[] = [];
    const teamDomains: Array = [];
    for (var i_1 = 0; i_1 < teamInputs.length; i_1++) {
        var teamInput = teamInputs[i_1];
        var teamDomain = teamInput.getElementsByClassName('team-name')[0].value;
        if (teamDomain === '' || teamDomain === null || teamDomain === undefined) {
            continue;
        }
        else if (teamDomains.includes(teamDomain)) {
            // Don't process team domains already listed.
            var teamStatus = teamInput.getElementsByClassName('team-status')[0];
            teamStatus.textContent = 'Ignored duplicate entry';
            teamStatus.style.color = 'grey';
            continue;
        }
        teamStatuses.push(teamValidity(teamInput));
        teamDomains.push(teamDomain);
    }
    var saveStatus = document.getElementById('settings-status');
    if (teamDomains.length > 0) {
        saveStatus.textContent = 'Saving...';
        saveStatus.style.color = 'black';
    }
    Promise.all(teamStatuses).then((status) => {
        if (teamDomains.length > 0) {
            chrome.storage.sync.set({
                'teamDomains': teamDomains,
            }, function () {
                // Update status to let user know options were saved.
                saveStatus.textContent = 'Options saved!';
                saveStatus.style.color = 'green';
                setTimeout(function () {
                    saveStatus.textContent = '';
                }, 750);
                chrome.runtime.sendMessage(teamDomains);
            });
        }
    }).catch((reason) => {
        saveStatus.textContent = 'Save failed.';
        saveStatus.style.color = 'red';
        setTimeout(function () {
            saveStatus.textContent = '';
        }, 750);
        errMsg = reason.toString();
        console.log(errMsg);
        if (errMsg.startsWith('Error: Not Logged in to ')) {
            teamUrl = errMsg.split(' ').slice(-1)[0];
            console.log('Opening tab for', teamUrl);
            setTimeout(() => {
                chrome.tabs.create({ url: teamUrl });
            }, 750);
        }
    });
}

/**
* An async function that indicates whether a team exists and is currently
* logged into.
* @param {Object} teamInput the team input row HTML element
* @return {Promise} a promise to the team status
*/
const teamValidity = (teamInput) => {
    return new Promise(function (resolve, reject) {
        var teamStatus = teamInput.getElementsByClassName('team-status')[0];
        var teamDomain = teamInput.getElementsByClassName('team-name')[0].value;
        console.log('Checking "' + teamDomain + '"');
        teamStatus.textContent = '';
        var xhr = new XMLHttpRequest();
        var teamUrl = 'https://' + teamDomain + '.slack.com/customize/emoji';
        xhr.open('GET', teamUrl, true);
        xhr.onload = function () {
            if (xhr.status === 200) {
                console.log(xhr.responseURL);
                if (teamUrl !== xhr.responseURL) {
                    teamStatus.textContent = 'Login to team in another tab';
                    teamStatus.style.color = 'red';
                    reject(Error('Not Logged in to ' + teamUrl));
                }
                else {
                    resolve(true);
                }
            }
            else {
                teamStatus.textContent = 'Team Not Found';
                teamStatus.style.color = 'red';
                reject(Error('Invalid Team'));
            }
        };
        xhr.onerror = function () {
            reject(Error('There was a network error.'));
        };
        xhr.send();
    });
}

/**
* Restores the team list from what is stored in chrome.storage.sync
*/
const restoreTeams = () => {
    chrome.storage.sync.get({
        'teamDomains': ['your-team-name'],
    }, function (items) {
        var teamsDiv = document.getElementById('teams');
        while (teamsDiv.hasChildNodes()) {
            teamsDiv.removeChild(teamsDiv.lastChild);
        }
        var teamNames = items.teamDomains;
        for (var i_2 = 0; i_2 < teamNames.length; i_2++) {
            var teamName = teamNames[i_2];
            teamDiv = createTeamDiv(teamName);
            teamsDiv.append(teamDiv);
        }
        if (teamsDiv.children.length == 1) {
            var removeIcon = teamsDiv.getElementsByClassName('remove-icon')[0];
            removeIcon.style.display = 'none';
        }
    });
}

/**
* Removes the respective team input box
* @param {String} teamName the click event that triggers this function
* @return {Object} teamDiv
*/
const createTeamDiv = (teamName) => {
    teamDiv = document.createElement('div');
    removeIcon = document.createElement('i');
    inputBox = document.createElement('input');
    slackDotCom = document.createElement('span');
    statusBox = document.createElement('span');
    removeIcon.className = 'remove-icon fa fa-trash-o';
    removeIcon.title = 'remove this row';
    removeIcon.addEventListener('click', function (event) {
        removeTeamInput(event);
    }, false);
    inputBox.style = 'text-align:center; width: 30%;';
    inputBox.type = 'text';
    inputBox.className = 'team-name';
    if (teamName !== undefined) {
        inputBox.value = teamName;
    }
    slackDotCom.innerHTML = ' .slack.com ';
    statusBox.className = 'team-status';
    teamDiv.className = 'team-input';
    teamDiv.append(removeIcon);
    teamDiv.append(' ');
    teamDiv.append(inputBox);
    teamDiv.append(slackDotCom);
    teamDiv.append(statusBox);
    return teamDiv;
}

/**
* Adds a team team input box
*/
const addTeamInput = () => {
    var teamDivs = document.getElementById('teams');
    var newTeamDiv = createTeamDiv();
    teamDivs.append(newTeamDiv);
    var removeIcons = teamDivs.getElementsByClassName('remove-icon');
    if (removeIcons.length == 2) {
        removeIcons[0].style.display = '';
    }
}

/**
* Removes the team input box associated with the clicked 'x' icon
* @param {event} event the click event that triggers this function
*/
const removeTeamInput = (event) => {
    var teamsDiv = document.getElementById('teams');
    var clickedIcon = event.target;
    var teamInputBox = clickedIcon.parentElement;
    teamsDiv.removeChild(teamInputBox);
    var removeIcons = teamsDiv.getElementsByClassName('remove-icon');
    if (removeIcons.length == 1) {
        removeIcons[0].style.display = 'none';
    }
}
document.addEventListener('DOMContentLoaded', restoreTeams);
document.getElementById('save').addEventListener('click', saveTeams);
document.getElementById('add-team').addEventListener('click', addTeamInput);
