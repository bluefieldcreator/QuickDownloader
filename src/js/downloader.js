// FIXME: Fix songs not downloading the folder.
// TODO: Add quality selection
// TODO: Add folder selection
// TODO: Add list downloading
// TODO: Better code lol


const fs = require("fs");
const ytdl = require("ytdl-core");
const progress = require("progress-stream");
const path = require("path");
const { shell } = require('electron');
const { BrowserWindow, dialog } = require('@electron/remote');
const { format } = require("path");
const downloadQueue = []
let convertedCount = 0

const currentWindow = BrowserWindow.getFocusedWindow()

const downloadProgressElement = document.querySelector("#downloadProgress");
const downloadProgressElementTwo = document.querySelector("#downloadProgressTwo");
const downloadProgressDiv = document.querySelector("#downloadProgressDiv")
const directorySelect = document.querySelector("#directorySelect")
const qualitySelector = document.querySelector("#qualitySelector")
const exportTypeSelector = document.querySelector("#exportTypeSelector")

const finishElement = document.querySelector("#done");
const infoElement = document.querySelector("#info")
const errorElement = document.querySelector("#error");

let saveDirectoryPath = path.join(__dirname + '\\..\\downloads')

directorySelect.textContent = saveDirectoryPath

let savedDirPath = window.localStorage.getItem("saveDirectoryPath")

if (savedDirPath) {
  directorySelect.textContent = savedDirPath
  saveDirectoryPath = savedDirPath
}

const openVideosFolder = () => {
  shell.openPath(saveDirectoryPath);
}

directorySelect.onclick = async () => {
  const files = await dialog.showOpenDialog({
      properties: ['openDirectory']
  })

  if (files !== undefined) {
    if (files.filePaths[0] !== undefined) {
      saveDirectoryPath = files.filePaths[0]
      directorySelect.textContent = saveDirectoryPath

      window.localStorage.setItem("saveDirectoryPath",saveDirectoryPath)
    }
  }
}

function updateQueueCount() {
  infoElement.style.display = ""

  infoElement.textContent = downloadQueue.length + " left in queue..."

  if (downloadQueue.length <= 0) {
    infoElement.style.display = "none"
  }
}

function addToQueue(videoURL, videoFileName) {
  downloadQueue.push({
    videoURL: videoURL,
    videoFileName: videoFileName,
    quality: qualitySelector.value,
    exportType: exportTypeSelector.value
  })
}

function logError(errorContent) {
  downloadProgressElement.style.backgroundColor = "#ff4747"

  errorElement.textContent = errorContent
  infoElement.style.display = "none"
  finishElement.style.display = "none"
  errorElement.style.display = ""

  downloadQueue.shift()
}

const downloadVideo = async (queueInfo, callback) => {
  finishElement.style.display = ""
  errorElement.style.display = "none"
  downloadProgressElement.style.backgroundColor = ""
  downloadProgressElementTwo.textContent = "0%";
  downloadProgressElement.style.width = "0%";

  convertedCount = convertedCount + 1
  downloadProgressDiv.style.display = ""
  downloadProgressDiv.style.opacity = "1"
  updateQueueCount()

  let videoURL = queueInfo.videoURL
  let videoFileName = queueInfo.videoFileName
  let vidQuality = queueInfo.quality
  let exportType = queueInfo.exportType

  if (!videoURL) {
    logError("No Video URL!")

    return
  }

  if (!fs.existsSync('./downloads'))
    fs.mkdirSync('./downloads');


  let data = await ytdl.getBasicInfo(videoURL).catch((err) => logError(err.message))
  
  if (data == undefined) {
    return
  }

  if (videoFileName == "") {
    videoFileName = data.videoDetails.videoId + "-" + convertedCount
  }

  if (data.videoDetails.isLiveContent == true) {
    logError("Cannot export a live video.")
    
    downloadQueue.shift()
    return
  }

  const progressDownload = progress({
    
    length: parseInt(data.formats[data.formats.length - 1].contentLength),
  });

  let percentageBarExtend = 70

  progressDownload.on("progress", function (progress) {
    let percentage = progress.percentage
    let percentageBar = progress.percentage

    if (percentageBar > 100) {
      percentageBarExtend = percentageBarExtend + 0.005
      if (percentageBarExtend > 99) {
        percentageBarExtend = percentageBarExtend + 0.003
        percentageBarExtend = 90

        if (percentageBarExtend > 95) {
          percentageBarExtend = 99
        }
      }
      percentageBar = percentageBarExtend
    }

    downloadProgressElementTwo.textContent = `${Math.round(percentage)}%`;
    downloadProgressElement.style.width = `${percentageBar}%`;

    currentWindow.setProgressBar(percentageBar,{
      mode: "normal"
    })
  });
  ytdl(videoURL, {quality: vidQuality, filter: format => format.container == exportType})
    .pipe(progressDownload)
    .pipe(
      fs.createWriteStream(saveDirectoryPath + `/${videoFileName}.${exportType}`)
        .on("finish", () => {
          finishElement.textContent = `${saveDirectoryPath}/${videoFileName}.${exportType} downloaded!`;
          downloadProgressElementTwo.textContent = "0%";
          downloadProgressElement.style.width = "0%";

          currentWindow.setProgressBar(0,{
            mode: "none"
          })
          infoElement.textContent = downloadQueue.length + " left in queue..."

            callback()
        })
        .on('error', (err) => {
          logError(err.message)

          downloadQueue.shift()
        })
    );

};

function downloadComplete() {
  downloadQueue.shift()
  infoElement.textContent = downloadQueue.length + " left in queue..."

  if (downloadQueue[0]) {
    console.log("Downloading..")
    downloadVideo(downloadQueue[0],downloadComplete)
    updateQueueCount()
  } else {

    downloadProgressElementTwo.textContent = "100%";
    downloadProgressElement.style.width = "100%";
    downloadProgressElement.style.backgroundColor = "#43e058"

    updateQueueCount()

  }
}

const downloadVideoQueue = async () => {
  const videoURL = document.querySelector("#url");
  const videoFileName = document.querySelector("#fileName");

  if (downloadQueue[0]) {
    console.log("Pending")
    addToQueue(videoURL.value, videoFileName.value)
    updateQueueCount()

    return
  } else {
    console.log("Downloading...")
    addToQueue(videoURL.value, videoFileName.value)
    downloadVideo(downloadQueue[0],downloadComplete)
    updateQueueCount()

  }
}

const cleanQueue = () => {
  if (downloadQueue[0]) {
    if (confirm("Are you sure you want to clear queue? This will also cancel all running tasks.")) {
      downloadQueue.length = 0
      window.location.reload()
    }
  }
}