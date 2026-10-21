/* tslint:disable */
/* eslint-disable */

export class Analyzer {
    free(): void;
    [Symbol.dispose](): void;
    frame(): Float32Array;
    constructor(sample_rate: number, bin_count: number);
    reset(): void;
    reset_simulator(now_ms: number): void;
    tick(spectrum_db: Float32Array, now_ms: number, dt: number): void;
    tick_idle(now_ms: number, dt: number): void;
    tick_simulated(now_ms: number, dt: number): void;
}

export class Downsampler {
    free(): void;
    [Symbol.dispose](): void;
    constructor(input_rate: number);
    push(input: Float32Array): Float32Array;
}

export class Fingerprint {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly bass: number;
    readonly brightness: number;
    readonly duration: number;
    readonly hashes: Uint32Array;
    readonly times: Uint32Array;
}

export class MatchStatus {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly candidate_id: string | undefined;
    readonly confirmed: boolean;
    readonly listened_seconds: number;
    readonly runner_up: number;
    readonly score: number;
}

export class Matcher {
    free(): void;
    [Symbol.dispose](): void;
    add_cue(id: string, hashes: Uint32Array, times: Uint32Array): void;
    clear_library(): void;
    finish_library(): void;
    constructor();
    push(chunk: Float32Array): MatchStatus | undefined;
    reset(): void;
}

export function demo_track_names(): string[];

export function fingerprint(samples: Float32Array): Fingerprint;

export function render_demo_track(index: number, sample_rate: number): Float32Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_analyzer_free: (a: number, b: number) => void;
    readonly __wbg_downsampler_free: (a: number, b: number) => void;
    readonly __wbg_fingerprint_free: (a: number, b: number) => void;
    readonly __wbg_matcher_free: (a: number, b: number) => void;
    readonly __wbg_matchstatus_free: (a: number, b: number) => void;
    readonly analyzer_frame: (a: number) => [number, number];
    readonly analyzer_new: (a: number, b: number) => number;
    readonly analyzer_reset: (a: number) => void;
    readonly analyzer_reset_simulator: (a: number, b: number) => void;
    readonly analyzer_tick: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly analyzer_tick_idle: (a: number, b: number, c: number) => void;
    readonly analyzer_tick_simulated: (a: number, b: number, c: number) => void;
    readonly demo_track_names: () => [number, number];
    readonly downsampler_new: (a: number) => number;
    readonly downsampler_push: (a: number, b: number, c: number) => [number, number];
    readonly fingerprint: (a: number, b: number) => number;
    readonly fingerprint_bass: (a: number) => number;
    readonly fingerprint_brightness: (a: number) => number;
    readonly fingerprint_duration: (a: number) => number;
    readonly fingerprint_hashes: (a: number) => [number, number];
    readonly fingerprint_times: (a: number) => [number, number];
    readonly matcher_add_cue: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly matcher_clear_library: (a: number) => void;
    readonly matcher_finish_library: (a: number) => void;
    readonly matcher_new: () => number;
    readonly matcher_push: (a: number, b: number, c: number) => number;
    readonly matcher_reset: (a: number) => void;
    readonly matchstatus_candidate_id: (a: number) => [number, number];
    readonly matchstatus_confirmed: (a: number) => number;
    readonly matchstatus_listened_seconds: (a: number) => number;
    readonly matchstatus_runner_up: (a: number) => number;
    readonly matchstatus_score: (a: number) => number;
    readonly render_demo_track: (a: number, b: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
