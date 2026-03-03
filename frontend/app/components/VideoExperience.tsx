import { RefObject } from "react";

type VideoExperienceProps = {
  onJoinVideoRoom: () => void;
  onLeaveVideoRoom: () => void;
  getRemoteVideoStream: (remoteUserId: string) => MediaStream | null;
  videoJoined: boolean;
  videoLocalVideoRef: RefObject<HTMLVideoElement | null>;
  videoParticipantCount: number;
  videoRemoteUserIds: string[];
};

export function VideoExperience({
  getRemoteVideoStream,
  onJoinVideoRoom,
  onLeaveVideoRoom,
  videoJoined,
  videoLocalVideoRef,
  videoParticipantCount,
  videoRemoteUserIds,
}: VideoExperienceProps) {
  return (
    <section className="mode-panel">
      <div className="mode-toolbar">
        {videoJoined ? (
          <button onClick={onLeaveVideoRoom} type="button">
            Leave Video Room
          </button>
        ) : (
          <button onClick={onJoinVideoRoom} type="button">
            Join Video Room
          </button>
        )}
      </div>

      <p className="muted">Participants connected: {videoParticipantCount}.</p>

      <div className="video-grid">
        <article>
          <h3>You</h3>
          <video
            autoPlay
            className="video-frame"
            muted
            playsInline
            ref={videoLocalVideoRef}
          />
        </article>
        {videoRemoteUserIds.map((remoteUserId) => (
          <article key={remoteUserId}>
            <h3>{remoteUserId}</h3>
            <video
              autoPlay
              className="video-frame"
              playsInline
              ref={(element) => {
                if (!element) {
                  return;
                }
                element.srcObject = getRemoteVideoStream(remoteUserId);
              }}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
