/**
 * Attempt to save the input teams to chrome.storage.sync
 */
function saveTeams() {
  const teamsDiv = document.getElementById("teams");
  const teamInputs = teamsDiv.children;
  const teamStatuses = [];
  const teamDomains: string[] = [];
  for (let i = 0; i < teamInputs.length; i++) {
    const teamInput = teamInputs[i];
    const teamNameElement = teamInput.getElementsByClassName(
      "team-name"
    )[0] as HTMLInputElement;
    const teamDomain = teamNameElement.value;
    if (teamDomain === "" || teamDomain === null || teamDomain === undefined) {
      continue;
    } else if (teamDomains.includes(teamDomain)) {
      // Don't process team domains already listed.
      const teamStatus = teamInput.getElementsByClassName(
        "team-status"
      )[0] as HTMLElement;
      teamStatus.textContent = "Ignored duplicate entry";
      teamStatus.style.color = "grey";
      continue;
    }
    teamStatuses.push(teamValidity(teamInput));
    teamDomains.push(teamDomain);
  }
  const saveStatus = document.getElementById("settings-status");

  if (teamDomains.length > 0) {
    saveStatus.textContent = "Saving...";
    saveStatus.style.color = "black";
  }

  Promise.all(teamStatuses)
    .then(function (status) {
      if (teamDomains.length > 0) {
        chrome.storage.sync.set(
          {
            teamDomains: teamDomains,
          },
          function () {
            // Update status to let user know options were saved.
            saveStatus.textContent = "Options saved!";
            saveStatus.style.color = "green";
            setTimeout(function () {
              saveStatus.textContent = "";
            }, 750);
            chrome.runtime.sendMessage(teamDomains);
          }
        );
      }
    })
    .catch(function (reason) {
      saveStatus.textContent = "Save failed.";
      saveStatus.style.color = "red";
      setTimeout(function () {
        saveStatus.textContent = "";
      }, 750);
      const errMsg = reason.toString();
      console.log(errMsg);
      if (errMsg.startsWith("Error: Not Logged in to ")) {
        const teamUrl = errMsg.split(" ").slice(-1)[0];
        console.log("Opening tab for", teamUrl);
        setTimeout(function () {
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
function teamValidity(teamInput) {
  return new Promise(function (resolve, reject) {
    const teamStatus = teamInput.getElementsByClassName("team-status")[0];
    const teamDomain = teamInput.getElementsByClassName("team-name")[0].value;
    console.log('Checking "' + teamDomain + '"');
    teamStatus.textContent = "";
    const xhr = new XMLHttpRequest();
    const teamUrl = "https://" + teamDomain + ".slack.com/customize/emoji";
    xhr.open("GET", teamUrl, true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        console.log(xhr.responseURL);
        if (teamUrl !== xhr.responseURL) {
          teamStatus.textContent = "Login to team in another tab";
          teamStatus.style.color = "red";
          reject(Error("Not Logged in to " + teamUrl));
        } else {
          resolve(true);
        }
      } else {
        teamStatus.textContent = "Team Not Found";
        teamStatus.style.color = "red";
        reject(Error("Invalid Team"));
      }
    };
    xhr.onerror = function () {
      reject(Error("There was a network error."));
    };
    xhr.send();
  });
}

/**
 * Restores the team list from what is stored in chrome.storage.sync
 */
function restoreTeams() {
  chrome.storage.sync.get(
    {
      teamDomains: ["your-team-name"],
    },
    function (items) {
      const teamsDiv = document.getElementById("teams");
      while (teamsDiv.hasChildNodes()) {
        teamsDiv.removeChild(teamsDiv.lastChild);
      }
      const teamNames = items.teamDomains;
      for (let i = 0; i < teamNames.length; i++) {
        const teamName = teamNames[i];
        const teamDiv = createTeamDiv(teamName);
        teamsDiv.append(teamDiv);
      }
      if (teamsDiv.children.length === 1) {
        const removeIcon = teamsDiv.getElementsByClassName("remove-icon")[0] as HTMLElement;
        if (removeIcon) {
          removeIcon.style.display = "none";
        }
      }
    }
  );
}

function createTeamDiv(teamName?: string) {
  const teamDiv = document.createElement("div");
  const removeIcon = document.createElement("i");
  const inputBox = document.createElement("input");
  const slackDotCom = document.createElement("span");
  const statusBox = document.createElement("span");

  removeIcon.className = "remove-icon fa fa-trash-o";
  removeIcon.title = "remove this row";
  removeIcon.addEventListener(
    "click",
    function (event) {
      removeTeamInput(event);
    },
    false
  );

  inputBox.style.textAlign = "center";
  inputBox.style.width = "30%";
  inputBox.type = "text";
  inputBox.className = "team-name";
  if (teamName !== undefined) {
    inputBox.value = teamName;
  }

  slackDotCom.innerHTML = " .slack.com ";

  statusBox.className = "team-status";

  teamDiv.className = "team-input";
  teamDiv.append(removeIcon);
  teamDiv.append(" ");
  teamDiv.append(inputBox);
  teamDiv.append(slackDotCom);
  teamDiv.append(statusBox);
  return teamDiv;
}

/**
 * Adds a team team input box
 */
function addTeamInput() {
  const teamDivs = document.getElementById("teams");
  const newTeamDiv = createTeamDiv();
  teamDivs.append(newTeamDiv);
  const removeIcons = teamDivs.getElementsByClassName("remove-icon");
  if (removeIcons.length === 2) {
    const firstIcon = removeIcons[0] as HTMLElement;
    firstIcon.style.display = "";
  }
}

/**
 * Removes the team input box associated with the clicked 'x' icon
 * @param {event} event the click event that triggers this function
 */
function removeTeamInput(event) {
  const teamsDiv = document.getElementById("teams");
  const clickedIcon = event.target;
  const teamInputBox = clickedIcon.parentElement;
  teamsDiv.removeChild(teamInputBox);
  const removeIcons = teamsDiv.getElementsByClassName("remove-icon");
  if (removeIcons.length === 1) {
    const firstIcon = removeIcons[0] as HTMLElement;
    firstIcon.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", restoreTeams);
document.getElementById("save").addEventListener("click", saveTeams);
document.getElementById("add-team").addEventListener("click", addTeamInput);
