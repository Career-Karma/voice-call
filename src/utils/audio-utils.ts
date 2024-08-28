export function destroyAudioPlayer(participantId: string) {
  const player = document.querySelector(
    `audio[data-participant-id="${participantId}"]`
  );
  player?.remove();
}

export async function buildAudioPlayer(track: any, participantId: string) {
  const player = document.createElement("audio");
  player.dataset.participantId = participantId;
  document.body.appendChild(player);
  await startPlayer(player, track);
  return player;
}

async function startPlayer(player: HTMLAudioElement, track: any) {
  player.muted = false;
  player.autoplay = true;
  if (track) {
    player.srcObject = new MediaStream([track]);
    await player.play();
  }
}
