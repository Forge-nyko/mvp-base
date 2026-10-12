const ZXING_FORMAT_KEYS = Object.freeze({
  ean_13: "EAN_13",
  ean_8: "EAN_8",
  upc_a: "UPC_A",
  upc_e: "UPC_E",
  code_128: "CODE_128",
});

export const NATIVE_DECODER_FALLBACK_MS = 2000;

export function isBarcodeVideoReady(video) {
  return Boolean(
    video &&
    Number(video.readyState) >= 2 &&
    Number(video.videoWidth) > 0 &&
    Number(video.videoHeight) > 0
  );
}

export function waitForBarcodeVideoReady(video, {signal} = {}) {
  if (isBarcodeVideoReady(video)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const events = ["loadeddata", "canplay", "resize"];
    const cleanup = () => {
      events.forEach((eventName) => video?.removeEventListener?.(eventName, handleReady));
      signal?.removeEventListener?.("abort", handleAbort);
    };
    const handleReady = () => {
      if (!isBarcodeVideoReady(video)) return;
      cleanup();
      resolve();
    };
    const handleAbort = () => {
      cleanup();
      const error = new Error("Se canceló la preparación del video.");
      error.name = "AbortError";
      reject(error);
    };
    events.forEach((eventName) => video?.addEventListener?.(eventName, handleReady));
    signal?.addEventListener?.("abort", handleAbort, {once: true});
    if (signal?.aborted) handleAbort();
    else handleReady();
  });
}

export function isZxingRetryableError(error, retryableErrorTypes) {
  return retryableErrorTypes.some((ErrorType) => error instanceof ErrorType);
}

export async function createBarcodeFrameDecoder({decoder, formats}) {
  if (decoder === "native") {
    const detector = new globalThis.BarcodeDetector({formats});
    return {
      kind: "native",
      async detect(video) {
        const codes = await detector.detect(video);
        return String(codes?.[0]?.rawValue || "");
      },
      stop() {},
    };
  }

  const {
    BarcodeFormat,
    BrowserMultiFormatReader,
    ChecksumException,
    DecodeHintType,
    FormatException,
    NotFoundException,
  } = await import("@zxing/library");
  const possibleFormats = formats
    .map((format) => BarcodeFormat[ZXING_FORMAT_KEYS[format]])
    .filter((format) => Number.isInteger(format));
  const hints = new Map([
    [DecodeHintType.POSSIBLE_FORMATS, possibleFormats],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new BrowserMultiFormatReader(hints, 250);
  const retryableErrorTypes = [NotFoundException, ChecksumException, FormatException];
  let captureWidth = 0;
  let captureHeight = 0;
  return {
    kind: "zxing",
    async detect(video) {
      if (!isBarcodeVideoReady(video)) return "";
      try {
        if (
          captureWidth &&
          (captureWidth !== video.videoWidth || captureHeight !== video.videoHeight)
        ) {
          reader.reset();
        }
        captureWidth = video.videoWidth;
        captureHeight = video.videoHeight;
        return String(reader.decode(video)?.getText?.() || "");
      } catch (error) {
        if (isZxingRetryableError(error, retryableErrorTypes)) return "";
        throw error;
      }
    },
    stop() {
      reader.reset();
    },
  };
}

function defaultNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

// Si el decoder nativo no lee nada en la ventana inicial, ZXing se suma y ambos
// se alternan por intento: el nativo sigue disponible para lecturas rápidas y
// ZXing cubre los códigos que el nativo no reconoce en ese equipo.
export async function createBarcodeDecoderSession({
  decoder,
  formats,
  createDecoder = createBarcodeFrameDecoder,
  fallbackAfterMs = NATIVE_DECODER_FALLBACK_MS,
  now = defaultNow,
  onFallback,
}) {
  const primaryDecoder = await createDecoder({decoder, formats});
  let fallbackDecoder = null;
  let fallbackUnavailable = false;
  let fallbackTurn = false;
  let decodeInFlight = false;
  let stopped = false;
  const startedAt = now();

  const startFallbackIfDue = async () => {
    if (
      primaryDecoder.kind !== "native" ||
      fallbackDecoder ||
      fallbackUnavailable ||
      now() - startedAt < fallbackAfterMs
    ) {
      return;
    }
    try {
      const created = await createDecoder({decoder: "zxing", formats});
      if (stopped) {
        created.stop?.();
        return;
      }
      fallbackDecoder = created;
      fallbackTurn = true;
      onFallback?.();
    } catch {
      // Sin ZXing, el decoder nativo continúa operando solo.
      fallbackUnavailable = true;
    }
  };

  return {
    get kind() {
      return fallbackDecoder ? "alternating" : primaryDecoder.kind;
    },
    async detect(video) {
      if (stopped || decodeInFlight || !isBarcodeVideoReady(video)) return "";
      decodeInFlight = true;
      try {
        await startFallbackIfDue();
        if (stopped) return "";
        const currentDecoder = fallbackDecoder && fallbackTurn ? fallbackDecoder : primaryDecoder;
        if (fallbackDecoder) fallbackTurn = !fallbackTurn;
        let rawValue = "";
        try {
          rawValue = await currentDecoder.detect(video);
        } catch (error) {
          // Un error del decoder nativo equivale a un cuadro sin lectura.
          if (stopped || currentDecoder.kind === "native") return "";
          throw error;
        }
        if (stopped) return "";
        return String(rawValue || "").trim() ? String(rawValue) : "";
      } finally {
        decodeInFlight = false;
      }
    },
    stop() {
      stopped = true;
      primaryDecoder.stop?.();
      fallbackDecoder?.stop?.();
    },
  };
}
