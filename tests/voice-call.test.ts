import DailyIframe, { DailyCall } from "@daily-co/daily-js";

import VoiceCall from "../src";
// import { buildAudioPlayer, destroyAudioPlayer } from "../src/utils/audio-utils";
// import { subscribeToTracks } from "../src/utils/track-utils";

// Mock external dependencies
jest.mock("@daily-co/daily-js", () => ({
  createCallObject: jest.fn(),
}));
jest.mock('../src/utils/audio-utils', () => ({
  buildAudioPlayer: jest.fn(),
  destroyAudioPlayer: jest.fn(),
}));

jest.mock('../src/utils/track-utils', () => ({
  subscribeToTracks: jest.fn(),
}));

describe("VoiceCall", () => {
  let voiceCall: VoiceCall;
  let mockCallObject: Partial<DailyCall>;

  beforeEach(() => {
    mockCallObject = {
      join: jest.fn().mockResolvedValue(null),
      on: jest.fn(),
      destroy: jest.fn(),
      sendAppMessage: jest.fn(),
      localAudio: jest.fn(),
      setLocalAudio: jest.fn(),
      startRemoteParticipantsAudioLevelObserver: jest.fn(),
      updateInputSettings: jest.fn(),
      iframe: jest.fn().mockReturnValue({
        style: {
          setProperty: jest.fn(),
        },
      }),
    };
    (DailyIframe.createCallObject as jest.Mock).mockReturnValue(mockCallObject);

    voiceCall = new VoiceCall({ publicKey: "test-key", token: "test-token" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("start()", () => {
    it("should start a call and set necessary properties", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: jest
          .fn()
          .mockResolvedValue({ webCallUrl: "https://example.com" }),
      });

      const result = await voiceCall.start({
        companionId: "test-companion",
        userId: "test-user",
      });

      expect(result).toEqual({ id: "test-companion" });
      expect(mockCallObject.join).toHaveBeenCalledWith({
        url: "https://example.com",
        subscribeToTracksAutomatically: false,
      });
      expect(
        mockCallObject.startRemoteParticipantsAudioLevelObserver
      ).toHaveBeenCalledWith(100);
    });

    it("should emit an error if the call fails to start", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({ webCallUrl: "https://example.com" }),
      });
    
      (mockCallObject.join as jest.Mock).mockRejectedValue(new Error("Join failed"));
    
      await expect(voiceCall.start({ companionId: "test-companion" })).rejects.toThrow("Join failed");
    });
  });

  describe("stop()", () => {
    it("should clean up the call", () => {
      voiceCall['call'] = mockCallObject as DailyCall;
      voiceCall.stop();
      expect(mockCallObject.destroy).toHaveBeenCalled();
    });    
  });

  describe("send()", () => {
    it("should send a message through the call", () => {
      voiceCall['call'] = mockCallObject as DailyCall;
      voiceCall.send({ text: "hello" });
      expect(mockCallObject.sendAppMessage).toHaveBeenCalledWith(JSON.stringify({ text: "hello" }));
    });
  });

  describe("mute() and unmute()", () => {
    it("should mute and unmute the local audio", () => {
      voiceCall['call'] = mockCallObject as DailyCall;
      voiceCall.mute();
      expect(mockCallObject.setLocalAudio).toHaveBeenCalledWith(false);
    
      voiceCall.unmute();
      expect(mockCallObject.setLocalAudio).toHaveBeenCalledWith(true);
    });    
  });

  describe("isMuted()", () => {
    it("should return true if the local audio is muted", () => {
      (mockCallObject.localAudio as jest.Mock).mockReturnValue(false);
      voiceCall['call'] = mockCallObject as DailyCall;
      expect(voiceCall.isMuted()).toBe(true);
    });
    
    it("should return false if the local audio is not muted", () => {
      (mockCallObject.localAudio as jest.Mock).mockReturnValue(true);
      voiceCall['call'] = mockCallObject as DailyCall;
      expect(voiceCall.isMuted()).toBe(false);
    });
    
  });
});
