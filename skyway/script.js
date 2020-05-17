const Peer = window.Peer;

(async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomId = document.getElementById('js-room-id');
  // const roomMode = document.getElementById('js-room-mode');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');

  const videoToggleButton = document.getElementById('video-toggle');
  const audioToglleButton = document.getElementById('audio-toggle');

  const joinedRoom = document.getElementById('joined-room');

  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

  //const getRoomModeByHash = () => (location.hash === '#sfu' ? 'sfu' : 'mesh');
  const ROOM_MODE = 'sfu';

  // roomMode.textContent = ROOM_MODE;
  // window.addEventListener(
  //   'hashchange',
  //   () => (roomMode.textContent = ROOM_MODE)
  // );

  let mediaConstraints = {
    audio: true,
    video: true,
  };

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

  //現在時刻取得（yyyy/mm/dd hh:mm:ss）
function getCurrentTime() {
	var now = new Date();
	var res = "" + now.getFullYear() + "/" + padZero(now.getMonth() + 1) + 
		"/" + padZero(now.getDate()) + " " + padZero(now.getHours()) + ":" + 
		padZero(now.getMinutes()) + ":" + padZero(now.getSeconds());
	return res;
}

//先頭ゼロ付加
function padZero(num) {
	var result;
	if (num < 10) {
		result = "0" + num;
	} else {
		result = "" + num;
	}
	return result;
}

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
      joinedRoom.textContent = roomId.value + ' ルームに参加中'
      // messages.textContent += '=== You さんが参加しました ===\n';
    });
    room.on('peerJoin', peerId => {
      messages.textContent += `=== ${peerId} さんが参加しました ===\n`;
    });

    // Render remote stream for new peer join in the room
    room.on('stream', async stream => {
      const newVideo = document.createElement('video');
      newVideo.srcObject = stream;
      newVideo.playsInline = true;
      // mark peerId to find it later at peerLeave event
      newVideo.setAttribute('data-peer-id', stream.peerId);
      newVideo.classList.add('video-menbers');
      remoteVideos.append(newVideo);
      await newVideo.play().catch(console.error);
    });

    room.on('data', ({ data, src }) => {
      // Show a message sent to the room and who sent
      messages.textContent += `${src}: ${data}\n`;
    });

    // for closing room members
    room.on('peerLeave', peerId => {
      const remoteVideo = remoteVideos.querySelector(
        `[data-peer-id=${peerId}]`
      );
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();

      messages.textContent += `=== ${peerId} さんが退出しました ===\n`;
    });

    // for closing myself
    room.once('close', () => {
      sendTrigger.removeEventListener('click', onClickSend);
      joinedRoom.textContent = '';
      // messages.textContent += '== You さんが退出しました ===\n';
      Array.from(remoteVideos.children).forEach(remoteVideo => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      });
    });

    sendTrigger.addEventListener('click', onClickSend);
    leaveTrigger.addEventListener('click', () => room.close(), { once: true });

    function onClickSend() {
      // Send message to all of the peers in the room via websocket
      room.send(localText.value);
      messages.textContent += `${getCurrentTime()} - ${peer.id}: ${localText.value}\n`;
      localText.value = '';
    }
  });

  peer.on('error', console.error);
})();