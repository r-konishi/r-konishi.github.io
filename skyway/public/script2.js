const Peer = window.Peer;

(async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomId = document.getElementById('js-room-id');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');

  const videoToggleButton = document.getElementById('video-toggle');
  const audioToglleButton = document.getElementById('audio-toggle');

  const joinedRoom = document.getElementById('joined-room');

  const userName = document.getElementById('js-username');

  const ROOM_MODE = 'sfu';

  let mediaConstraints = {
    audio: true,
    video: true,
  };

    //現在時刻取得（yyyy/mm/dd hh:mm:ss）<- ライセンス注意（どこからともなく拾ってきたもの）
    function getCurrentTime() {
      var now = new Date();
      var res = "" + now.getFullYear() + "/" + padZero(now.getMonth() + 1) + 
        "/" + padZero(now.getDate()) + " " + padZero(now.getHours()) + ":" + 
        padZero(now.getMinutes()) + ":" + padZero(now.getSeconds());
      return res;
    }

    //先頭ゼロ付加　<- ライセンス注意（どこからともなく拾ってきたもの）
    function padZero(num) {
      var result;
      if (num < 10) {
        result = "0" + num;
      } else {
        result = "" + num;
      }
      return result;
    }

  /**
   * メッセージ追加
   * @param {string} userName 
   * @param {string} message 
   */
  const addMessage = (userName, message) => {
    const addMessageHTML = `
    <div class="message-box">
      <div class="message-top-box">
          <div class="message-name">${userName} さん</div>
          <div class="message-time">${getCurrentTime()}</div>
      </div>
      <div class="message-body-box">
          <pre class="message">${message}</pre>
      </div>
    </div>
    <hr>`;
    messages.innerHTML += addMessageHTML;
  }

  const addRemoteVideo = async stream => {
    const newVideo = document.createElement('video');
    const videoBox = document.createElement('div');
    videoBox.classList.add('receive-video-box');
    newVideo.srcObject = stream;
    newVideo.playsInline = true;
    // mark peerId to find it later at peerLeave event
    newVideo.setAttribute('data-peer-id', stream.peerId);
    newVideo.classList.add('video-menbers');
    videoBox.append(newVideo);
    remoteVideos.append(videoBox);
    await newVideo.play().catch(console.error);
  }

  let localStream = await navigator.mediaDevices
    .getUserMedia(mediaConstraints)
    .then((stream) => {
      console.log(stream);
      videoToggleButton.textContent = mediaConstraints.video ? '映像：ON' : '映像：OFF';
      audioToglleButton.textContent = mediaConstraints.audio ? '音声：ON' : '音声：OFF';
      return stream
    })
    .catch(console.error);;

  videoToggleButton.addEventListener('click', () => {

    mediaConstraints.video = !mediaConstraints.video;
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = mediaConstraints.video;
    videoToggleButton.textContent = mediaConstraints.video ? '映像：ON' : '映像：OFF';
  });

  audioToglleButton.addEventListener('click', () => {
    mediaConstraints.audio = !mediaConstraints.audio;
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = mediaConstraints.audio;
    audioToglleButton.textContent = mediaConstraints.audio ? '音声：ON' : '音声：OFF';
  });
  // get media device list
  navigator.mediaDevices.enumerateDevices()
    .then(function (devices) {
      devices.forEach(function (device) {
        console.log(device.kind + ": " + device.label +
          " id = " + device.deviceId);
      });
    })
    .catch(function (err) {
      console.log(err.name + ": " + err.message);
    });

  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

  // eslint-disable-next-line require-atomic-updates
  const peer = (window.peer = new Peer({
    key: window.__SKYWAY_KEY__,
    debug: 3,
  }));

  // Register join handler
  joinTrigger.addEventListener('click', () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }

    const room = peer.joinRoom(roomId.value, {
      mode: ROOM_MODE,
      stream: localStream,
    });

    room.once('open', () => {
      joinedRoom.textContent = roomId.value + ' ルームに参加中';
      userName.textContent = peer.id;
      roomId.setAttribute('disabled', true);
      joinTrigger.setAttribute('disabled', true);
      leaveTrigger.removeAttribute('disabled');
    });
    room.on('peerJoin', peerId => {
      addMessage('システム', `=== ${peerId} さんが参加しました ===`);
    });

    // Render remote stream for new peer join in the room
    room.on('stream', addRemoteVideo);

    room.on('data', ({ data, src }) => {
      // Show a message sent to the room and who sent
      addMessage(src, data);
    });

    // for closing room members
    room.on('peerLeave', peerId => {
      const remoteVideo = remoteVideos.querySelector(
        `[data-peer-id=${peerId}]`
      );
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.parentNode.remove();

      addMessage('システム', `=== ${peerId} さんが退出しました ===`);
    });

    // for closing myself
    room.once('close', () => {
      // 自信が退出
      sendTrigger.removeEventListener('click', onClickSend);
      joinedRoom.textContent = '部屋に参加していません。';
      messages.innerHTML = '';
      userName.innerHTML = '';
      leaveTrigger.setAttribute('disabled', true);
      joinTrigger.removeAttribute('disabled');
      roomId.removeAttribute('disabled');

      Array.from(remoteVideos.children).forEach(videoBox => {
        Array.from(videoBox.children).forEach(remoteVideo => {
          if(remoteVideo.srcObject && remoteVideo.srcObject.getTracks() && remoteVideo.srcObject.getTracks().length > 0) {
            remoteVideo.srcObject.getTracks().forEach(track => track.stop());
          }
          remoteVideo.srcObject = null;
        });
        videoBox.remove();
      });
    });

    sendTrigger.addEventListener('click', onClickSend);
    leaveTrigger.addEventListener('click', () => room.close(), { once: true });

    function onClickSend() {
      // Send message to all of the peers in the room via websocket
      room.send(localText.value);
      addMessage(peer.id, localText.value)
      localText.value = '';
    }
  });

  peer.on('error', console.error);
})();