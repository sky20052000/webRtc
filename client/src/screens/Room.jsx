import React, { useEffect, useCallback, useState, useRef } from "react";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const [joinCall, setJoinCall] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);
  const recordedChunks = useRef([]);

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
  }, []);

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
    setMyStream(stream);
    setIsInitiator(true); // Mark this user as the initiator
    startRecording(stream); // Start recording when the call starts
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      setRemoteSocketId(from);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
    setJoinCall(true);
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      setJoinCall(true);
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);

  const handleDisconnectCall = useCallback(() => {
    peer.peer.close();
    setRemoteSocketId(null);
    setRemoteStream(null);
    setMyStream(null);
    if (isInitiator) {
      stopRecording(); // Stop recording only if this user is the initiator
    }
    setIsInitiator(false); // Reset the initiator status
    socket.emit("call:disconnect", { to: remoteSocketId });
  }, [remoteSocketId, socket, isInitiator]);

  const startRecording = (stream) => {
    const options = { mimeType: "video/webm; codecs=vp9" };
    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.onstop = handleStop;
    mediaRecorder.start();
    setIsRecording(true);
  };

  const handleDataAvailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.current.push(event.data);
    }
  };

  const handleStop = () => {
    const blob = new Blob(recordedChunks.current, {
      type: "video/webm",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = "recording.webm";
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    setIsRecording(false);
    recordedChunks.current = [];
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    peer.peer.addEventListener("track", (ev) => {
      const remoteStream = ev.streams[0];
      setRemoteStream(remoteStream);
    });
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);
    socket.on("call:disconnect", handleDisconnectCall);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
      socket.off("call:disconnect", handleDisconnectCall);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
    handleDisconnectCall,
  ]);

  return (
    <div>
      <h1>Room Page</h1>
      <h4>{remoteSocketId ? "Connected" : "No one in room"}</h4>
      {
        joinCall ? null :
        <>{myStream && !isInitiator && <button onClick={sendStreams}>Join Stream</button>}</>
      }
      {
        !joinCall ? <>{remoteSocketId && !isInitiator && <button onClick={handleCallUser}>Call Start</button>}</> : null
      }
      {remoteSocketId && <button onClick={handleDisconnectCall}>Disconnect Call</button>}
      {isRecording && <h4>Recording...</h4>}
      {myStream && (
        <>
          <h1>My Stream</h1>
          <ReactPlayer
            playing
            height="300px"
            width="600px"
            url={myStream}
          />
        </>
      )}
      {remoteStream && (
        <>
          <h1>Remote Stream</h1>
          <ReactPlayer
            playing
            height="300px"
            width="600px"
            url={remoteStream}
          />
        </>
      )}
    </div>
  );
};

export default RoomPage;
