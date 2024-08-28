import { DailyCall, DailyEventObjectParticipant } from "@daily-co/daily-js";

export function subscribeToTracks(
  e: DailyEventObjectParticipant,
  call: DailyCall
) {
  if (!e.participant.local) {
    call.updateParticipant(e.participant.session_id, {
      setSubscribedTracks: {
        audio: true,
        video: false,
      },
    });
  }
}
