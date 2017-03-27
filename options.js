/**
* Attempt to save the input teams to chrome.storage.sync
*/
function saveTeams() {
  let teamsDiv = document.getElementById('teams');
  let teamInputs = teamsDiv.children;
  teamStatuses = [];
  teamDomains = [];
  for (let i=0; i < teamInputs.length; i++) {
    let teamInput = teamInputs[i];
    let teamDomain = teamInput.getElementsByClassName('team-name')[0].value;
    if (teamDomain === '' || teamDomain === null || teamDomain === undefined) {
      continue;
    } else if (teamDomains.includes(teamDomain)) {
      // Don't process team domains already listed.
      let teamStatus = teamInput.getElementsByClassName('team-status')[0];
      teamStatus.textContent = 'Ignored duplicate entry';
      teamStatus.style.color = 'grey';
      continue;
    }
    teamStatuses.push(teamValidity(teamInput));
    teamDomains.push(teamDomain);
  }
  let saveStatus = document.getElementById('settings-status');

  if (teamDomains.length>0) {
    saveStatus.textContent = 'Saving...';
    saveStatus.style.color = 'black';
  }

  Promise.all(teamStatuses).then(function(status) {
    if (teamDomains.length>0) {
      chrome.storage.sync.set({
        'teamDomains': teamDomains,
      }, function() {
        // Update status to let user know options were saved.
        saveStatus.textContent = 'Options saved!';
        saveStatus.style.color = 'green';
        setTimeout(function() {
          saveStatus.textContent = '';
        }, 750);
        chrome.runtime.sendMessage(teamDomains);
      });
    }
  }).catch(function(reason) {
    saveStatus.textContent = 'Save failed.';
    saveStatus.style.color = 'red';
    setTimeout(function() {
      saveStatus.textContent = '';
    }, 750);
    errMsg = reason.toString();
    console.log(errMsg);
    if (errMsg.startsWith('Error: Not Logged in to ')) {
      teamUrl = errMsg.split(' ').slice(-1)[0];
      console.log('Opening tab for', teamUrl);
      setTimeout(function() {
        chrome.tabs.create({url: teamUrl});
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
function teamValidity(teamInput) {
  return new Promise(function(resolve, reject) {
    let teamStatus = teamInput.getElementsByClassName('team-status')[0];
    let teamDomain = teamInput.getElementsByClassName('team-name')[0].value;
    console.log('Checking "' + teamDomain + '"');
    teamStatus.textContent = '';
    let xhr = new XMLHttpRequest();
    let teamUrl = 'https://' + teamDomain + '.slack.com/customize/emoji';
    xhr.open('GET', teamUrl, true);
    xhr.onload = function() {
      if (xhr.status === 200) {
        console.log(xhr.responseURL);
        if (teamUrl !== xhr.responseURL) {
          teamStatus.textContent = 'Login to team in another tab';
          teamStatus.style.color = 'red';
          reject(Error('Not Logged in to ' + teamUrl));
        } else {
          resolve(true);
        }
      } else {
          teamStatus.textContent = 'Team Not Found';
          teamStatus.style.color = 'red';
          reject(Error('Invalid Team'));
      }
    };
    xhr.onerror = function() {
      reject(Error('There was a network error.'));
    };
    xhr.send();
  });
}

/**
* Restores the team list from what is stored in chrome.storage.sync
*/
function restoreTeams() {
  chrome.storage.sync.get({
    'teamDomains': ['your-team-name'],
  }, function(items) {
    let teamsDiv = document.getElementById('teams');
    while (teamsDiv.hasChildNodes()) {
      teamsDiv.removeChild(teamsDiv.lastChild);
    }
    let teamNames = items.teamDomains;
    for (let i = 0; i < teamNames.length; i++) {
      let teamName = teamNames[i];
      teamDiv = createTeamDiv(teamName);
      teamsDiv.append(teamDiv);
    }
    if (teamsDiv.children.length == 1) {
      let removeIcon = teamsDiv.getElementsByClassName('remove-icon')[0];
      removeIcon.style.display = 'none';
    }
  });
}


/**
* Removes the respective team input box
* @param {String} teamName the click event that triggers this function
* @return {Object} teamDiv
*/
function createTeamDiv(teamName) {
  teamDiv = document.createElement('div');
  removeIcon = document.createElement('i');
  inputBox = document.createElement('input');
  slackDotCom = document.createElement('span');
  statusBox = document.createElement('span');

  removeIcon.className='remove-icon fa fa-trash-o';
  removeIcon.title='remove this row';
  removeIcon.addEventListener('click', function(event) {
    removeTeamInput(event);
  }, false);

  inputBox.style='text-align:center; width: 30%;';
  inputBox.type='text';
  inputBox.className='team-name';
  if (teamName !== undefined) {
    inputBox.value=teamName;
  }

  slackDotCom.innerHTML=' .slack.com ';

  statusBox.className='team-status';

  teamDiv.className='team-input';
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
function addTeamInput() {
  let teamDivs = document.getElementById('teams');
  let newTeamDiv = createTeamDiv();
  teamDivs.append(newTeamDiv);
  let removeIcons = teamDivs.getElementsByClassName('remove-icon');
  if (removeIcons.length == 2) {
    removeIcons[0].style.display = '';
  }
}

/**
* Removes the team input box associated with the clicked 'x' icon
* @param {event} event the click event that triggers this function
*/
function removeTeamInput(event) {
  let teamsDiv = document.getElementById('teams');
  let clickedIcon = event.target;
  let teamInputBox = clickedIcon.parentElement;
  teamsDiv.removeChild(teamInputBox);
  let removeIcons = teamsDiv.getElementsByClassName('remove-icon');
  if (removeIcons.length == 1) {
    removeIcons[0].style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', restoreTeams);
document.getElementById('save').addEventListener('click', saveTeams);
document.getElementById('add-team').addEventListener('click', addTeamInput);
