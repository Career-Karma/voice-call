import DailyIframe, {
  DailyCall,
  DailyEventObjectAppMessage,
  DailyEventObjectRemoteParticipantsAudioLevel,
} from "@daily-co/daily-js";
import { CallEventEmitter } from "./events/call-event-emitter";
import { buildAudioPlayer, destroyAudioPlayer } from "./utils/audio-utils";
import { subscribeToTracks } from "./utils/track-utils";

const COMPANION_CALL_URL = "/rest/v1/call/web";
const WORKFLOW_CALL_URL = "/rest/v2/call/web";

type VoiceCallOptions = {
  companionId?: string;
  workflowId?: string;
  userId?: string;
  variables?: { [key: string]: unknown };
  customCallUrl?: string;
  metadata?: { [key: string]: unknown };
};

export class VoiceCall extends CallEventEmitter {
  public started: boolean = false;
  private call: DailyCall | null = null;
  private speakingTimeout: NodeJS.Timeout | null = null;
  private publicKey?: string;
  private token?: string;
  private baseApiUrl: string;

  constructor(credential?: { publicKey: string; token: string, baseApiUrl?: string }) {
    super();
    this.publicKey = credential?.publicKey;
    this.token = credential?.token;
    this.baseApiUrl = credential?.baseApiUrl || "https://api.careerkarma.com";
  }

  async start({
    companionId,
    workflowId,
    userId,
    variables,
    customCallUrl,
    metadata,
  }: VoiceCallOptions): Promise<{ id: string } | null> {
    if (this.started) return null;
    this.started = true;

    try {
      let voiceCallUrl = customCallUrl;
      if (!voiceCallUrl) {
        voiceCallUrl = await this.fetchVoiceCallUrl({
          companionId,
          workflowId,
          userId,
          variables,
          metadata
        });
      }

      if (!voiceCallUrl) throw new Error("Failed to obtain call URL.");

      this.cleanupIfExists();
      try {
        this.call = DailyIframe.createCallObject({
          audioSource: true,
          videoSource: false,
        });
      } catch (e) {
        return null;
      }
      this.hideIframe();

      this.setupCallListeners();

      await this.call.join({
        url: voiceCallUrl,
        subscribeToTracksAutomatically: false,
      });

      this.call.startRemoteParticipantsAudioLevelObserver(100);

      this.call.updateInputSettings({
        audio: {
          processor: {
            type: "noise-cancellation",
          },
        },
      });

      return { id: workflowId || companionId || userId || "" };
    } catch (e) {
      this.emit("error", e);
      this.cleanup();
      return null;
    }
  }

  stop(): void {
    this.cleanup();
  }

  send(message: any): void {
    this.call?.sendAppMessage(JSON.stringify(message));
  }

  mute() {
    this.toggleAudio(false);
  }

  unmute() {
    this.toggleAudio(true);
  }

  isMuted(): boolean {
    return this.call?.localAudio() === false;
  }

  private cleanup() {
    this.started = false;
    this.call?.destroy();
    this.call = null;
    this.speakingTimeout = null;
  }

  private cleanupIfExists() {
    if (this.call) this.cleanup();
  }

  private hideIframe() {
    this.call?.iframe()?.style.setProperty("display", "none");
  }

  private setupCallListeners() {
    if (!this.call) return;

    this.call.on("left-meeting", () => {
      this.emit("call-end");
      this.cleanup();
    });

    this.call.on("participant-left", (e) => {
      if (e) destroyAudioPlayer(e.participant.session_id);
    });

    this.call.on("error", (error) => {
      this.emit("error", error);
    });

    this.call.on("camera-error", (error: any) => {
      this.emit("error", error);
    });

    this.call.on("track-started", async (e) => {
      if (e?.participant && e.track.kind === "audio") {
        await buildAudioPlayer(e.track, e.participant.session_id);
      }

      if (e?.participant?.user_name === "") return;
      this.call?.sendAppMessage("playable");
    });

    this.call.on("participant-joined", (e) => {
      if (this.call && e) subscribeToTracks(e, this.call);
    });

    this.call.on("remote-participants-audio-level", (e) => {
      if (e) this.handleRemoteParticipantsAudioLevel(e);
    });

    this.call.on("app-message", (e) => this.onAppMessage(e));
  }

  private async fetchVoiceCallUrl({
    companionId,
    workflowId,
    userId,
    variables,
    metadata = {},
  }: {
    companionId?: string;
    workflowId?: string;
    userId?: string;
    variables?: { [key: string]: unknown };
    metadata?: { [key: string]: unknown };
  }): Promise<string> {
    const endpoint = companionId ? COMPANION_CALL_URL : WORKFLOW_CALL_URL;

    const response = await fetch(`${this.baseApiUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { "X-Public-Token": this.token } : {}),
        ...(this.publicKey ? { "X-Public-Key": this.publicKey } : {}),
      },
      body: JSON.stringify({
        assistantId: companionId,
        workflowId,
        externalId: userId,
        variables,
        metadata,
      }),
    });

    const call = await response.json();
    if (!call || call.error)
      throw new Error(call.error || "Failed to create call");

    return call.webCallUrl;
  }

  private handleRemoteParticipantsAudioLevel(
    e: DailyEventObjectRemoteParticipantsAudioLevel
  ) {
    const speechLevel = Object.values(e.participantsAudioLevel).reduce(
      (a: number, b: number) => a + b,
      0
    );
    this.emit("volume-level", Math.min(1, speechLevel / 0.15));

    const isSpeaking = speechLevel > 0.01;
    if (!isSpeaking) return;

    if (this.speakingTimeout) {
      clearTimeout(this.speakingTimeout);
      this.speakingTimeout = null;
    } else {
      this.emit("speech-start");
    }

    this.speakingTimeout = setTimeout(() => {
      this.emit("speech-end");
      this.speakingTimeout = null;
    }, 1000);
  }

  private onAppMessage(e: DailyEventObjectAppMessage) {
    if (!e) return;
    try {
      if (e.data === "listening") {
        this.emit("call-start");
      } else {
        try {
          const parsedMessage = JSON.parse(e.data);
          this.emit("message", parsedMessage);
        } catch (parseError) {
          console.error("Error parsing message data: ", parseError);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  private toggleAudio(enable: boolean) {
    if (!this.call) throw new Error("Call object is not available.");
    this.call.setLocalAudio(enable);
  }
}
