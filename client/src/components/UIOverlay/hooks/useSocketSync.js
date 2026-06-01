import { useEffect } from "react";
import { io } from "socket.io-client";

const socket = io(process.env.REACT_APP_API_BASE_URL);

export default function useSocketSync(onObjectChange) {
  useEffect(() => {
    socket.on("objectChange", onObjectChange);
    return () => socket.off("objectChange", onObjectChange);
  }, [onObjectChange]);
}
