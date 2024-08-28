import { EventEmitter } from "events";

type CallEventNames =
  | "call-end"
  | "call-start"
  | "volume-level"
  | "speech-start"
  | "speech-end"
  | "message"
  | "error";

type CallEventListeners = {
  "call-end": () => void;
  "call-start": () => void;
  "volume-level": (volume: number) => void;
  "speech-start": () => void;
  "speech-end": () => void;
  message: (message: any) => void;
  error: (error: any) => void;
};

export class CallEventEmitter extends EventEmitter {
  on<E extends CallEventNames>(
    event: E,
    listener: CallEventListeners[E]
  ): this {
    super.on(event, listener);
    return this;
  }

  once<E extends CallEventNames>(
    event: E,
    listener: CallEventListeners[E]
  ): this {
    super.once(event, listener);
    return this;
  }

  emit<E extends CallEventNames>(
    event: E,
    ...args: Parameters<CallEventListeners[E]>
  ): boolean {
    return super.emit(event, ...args);
  }

  removeListener<E extends CallEventNames>(
    event: E,
    listener: CallEventListeners[E]
  ): this {
    super.removeListener(event, listener);
    return this;
  }

  removeAllListeners(event?: CallEventNames): this {
    super.removeAllListeners(event);
    return this;
  }
}
