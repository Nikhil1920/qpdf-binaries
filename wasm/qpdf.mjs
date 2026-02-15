/**
 * qpdf.mjs — High-level JavaScript wrapper around the qpdf WASM module.
 *
 * Provides two interfaces:
 *   1. CLI-style:   qpdf.callMain([...args]) + qpdf.FS  (virtual filesystem)
 *   2. Library-style: qpdf.readPdf(bytes) → process → qpdf.writePdf() → Uint8Array
 *
 * Usage:
 *   import { createQpdf } from './qpdf.mjs';
 *
 *   const qpdf = await createQpdf({ wasmUrl: '/path/to/qpdf.wasm' });
 *
 *   // --- CLI-style ---
 *   qpdf.FS.writeFile('/input.pdf', pdfBytes);
 *   qpdf.callMain(['--linearize', '/input.pdf', '/output.pdf']);
 *   const result = qpdf.FS.readFile('/output.pdf');
 *
 *   // --- Library-style ---
 *   const output = qpdf.processPdf(pdfBytes, { linearize: true });
 */

// The Emscripten-generated module loader will be at this path after build.
// Adjust the import if your bundler needs a different path.
import createModule from "./qpdf_wasm.js";

/**
 * Initialize the qpdf WASM module.
 *
 * @param {Object} options
 * @param {string} [options.wasmUrl] - URL to the .wasm file (for browsers / CDN).
 *   In Node.js this is optional if the .wasm sits next to the .js file.
 * @returns {Promise<QpdfInstance>}
 */
export async function createQpdf(options = {}) {
    const moduleOpts = {};

    if (options.wasmUrl) {
        moduleOpts.locateFile = () => options.wasmUrl;
    }

    // Don't auto-run main() — we call it explicitly when needed.
    moduleOpts.noInitialRun = true;

    const Module = await createModule(moduleOpts);

    // ----- cwrap helpers for the C API -----
    const _init = Module.cwrap("qpdf_wasm_init", "number", []);
    const _cleanup = Module.cwrap("qpdf_wasm_cleanup", null, ["number"]);
    // The C signature uses `unsigned long long size` which Emscripten legalizes
    // into two i32 args (size_lo, size_hi). The exported WASM function therefore
    // takes 5 args: (handle, buffer, size_lo, size_hi, password).
    const _readMemoryRaw = Module.cwrap("qpdf_wasm_read_memory", "number", [
        "number", // qpdf handle
        "number", // buffer pointer
        "number", // size low 32 bits
        "number", // size high 32 bits (always 0 — PDFs < 4 GB)
        "string", // password
    ]);
    const _readMemory = (handle, ptr, size, password) => {
        return _readMemoryRaw(handle, ptr, size, 0, password);
    };
    const _emptyPdf = Module.cwrap("qpdf_wasm_empty_pdf", "number", ["number"]);
    const _initWriteMemory = Module.cwrap(
        "qpdf_wasm_init_write_memory",
        "number",
        ["number"],
    );
    const _write = Module.cwrap("qpdf_wasm_write", "number", ["number"]);
    const _getBufferLength = Module.cwrap(
        "qpdf_wasm_get_buffer_length",
        "number",
        ["number"],
    );
    const _getBuffer = Module.cwrap("qpdf_wasm_get_buffer", "number", [
        "number",
    ]);
    const _setLinearize = Module.cwrap("qpdf_wasm_set_linearization", null, [
        "number",
        "number",
    ]);
    const _setCompress = Module.cwrap("qpdf_wasm_set_compress_streams", null, [
        "number",
        "number",
    ]);
    const _setPreserveEnc = Module.cwrap(
        "qpdf_wasm_set_preserve_encryption",
        null,
        ["number", "number"],
    );
    const _setDetId = Module.cwrap("qpdf_wasm_set_deterministic_id", null, [
        "number",
        "number",
    ]);
    const _setQdf = Module.cwrap("qpdf_wasm_set_qdf_mode", null, [
        "number",
        "number",
    ]);
    const _getPdfVersion = Module.cwrap("qpdf_wasm_get_pdf_version", "string", [
        "number",
    ]);
    const _getNumPages = Module.cwrap("qpdf_wasm_get_num_pages", "number", [
        "number",
    ]);
    const _isEncrypted = Module.cwrap("qpdf_wasm_is_encrypted", "number", [
        "number",
    ]);
    const _isLinearized = Module.cwrap("qpdf_wasm_is_linearized", "number", [
        "number",
    ]);
    const _getInfoKey = Module.cwrap("qpdf_wasm_get_info_key", "string", [
        "number",
        "string",
    ]);
    const _setInfoKey = Module.cwrap("qpdf_wasm_set_info_key", null, [
        "number",
        "string",
        "string",
    ]);
    const _hasError = Module.cwrap("qpdf_wasm_has_error", "number", ["number"]);
    const _getErrorText = Module.cwrap(
        "qpdf_wasm_get_error_full_text",
        "string",
        ["number"],
    );
    const _checkPdf = Module.cwrap("qpdf_wasm_check_pdf", "number", ["number"]);
    const _runJobJson = Module.cwrap("qpdf_wasm_run_job_json", "number", [
        "string",
    ]);
    const _version = Module.cwrap("qpdf_wasm_version", "string", []);

    // ----- Helper: copy a Uint8Array into WASM heap and return the pointer -----
    function allocBytes(uint8Array) {
        const ptr = Module._malloc(uint8Array.length);
        Module.HEAPU8.set(uint8Array, ptr);
        return ptr;
    }

    // ----- Helper: check for errors and throw -----
    function throwIfError(handle) {
        if (_hasError(handle)) {
            const msg = _getErrorText(handle);
            console.log("Has Error : ", msg);
            throw new Error(`qpdf error: ${msg}`);
        } else {
            console.log("No error");
        }
    }

    // ----- Helper: wrap WASM calls to catch raw Emscripten exception pointers -----
    // Emscripten-compiled C++ can throw raw numeric heap pointers instead of Error
    // objects. This helper re-throws proper Errors with the actual qpdf error text.
    function rethrowWasmError(e, handle, fallbackMsg) {
        if (e instanceof Error) throw e;
        // Raw WASM pointer — try to extract the real error message from the handle
        let msg;
        try {
            msg = _getErrorText(handle);
        } catch (_) {
            // handle may already be invalid
        }
        throw new Error(msg ? `qpdf error: ${msg}` : fallbackMsg);
    }

    // ===== Public API =====

    return {
        /**
         * The raw Emscripten Module, for advanced use.
         */
        _module: Module,

        init: _init,
        cleanup: _cleanup,
        readMemory: _readMemory,
        emptyPdf: _emptyPdf,
        initWriteMemory: _initWriteMemory,
        write: _write,
        getBufferLength: _getBufferLength,
        getBuffer: _getBuffer,
        setLinearize: _setLinearize,
        setCompress: _setCompress,
        setPreserveEnc: _setPreserveEnc,
        setDetId: _setDetId,
        setQdf: _setQdf,
        getPdfVersion: _getPdfVersion,
        getNumPages: _getNumPages,
        isEncrypted: _isEncrypted,
        isLinearized: _isLinearized,
        getInfoKey: _getInfoKey,
        setInfoKey: _setInfoKey,
        hasError: _hasError,
        getErrorText: _getErrorText,
        checkPdf: _checkPdf,
        runJobJson: _runJobJson,
        version: _version,

        allocBytes,
        throwIfError,
        rethrowWasmError,

        /**
         * Emscripten virtual filesystem — use for CLI-style operations.
         * @example
         *   qpdf.FS.writeFile('/input.pdf', pdfBytes);
         *   qpdf.callMain(['--linearize', '/input.pdf', '/output.pdf']);
         *   const result = qpdf.FS.readFile('/output.pdf');
         */
        FS: Module.FS,

        /**
         * Run the qpdf CLI with the given arguments.
         * Write input files to the FS first, read output files after.
         * @param {string[]} args - CLI arguments (without the 'qpdf' program name).
         */
        callMain(args) {
            Module.callMain(args);
        },

        /**
         * Run a qpdf job from a JSON description.
         * See https://qpdf.readthedocs.io/en/stable/qpdf-job.html
         * @param {object} jobJson
         * @returns {number} exit code (0 = success)
         */
        runJob(jobJson) {
            return _runJobJson(JSON.stringify(jobJson));
        },

        /**
         * Get the qpdf library version string.
         * @returns {string}
         */
        version() {
            return _version();
        },

        /**
         * Get information about a PDF without modifying it.
         * @param {Uint8Array} pdfBytes
         * @param {string} [password]
         * @returns {{ version: string, pages: number, encrypted: boolean, linearized: boolean }}
         */
        getInfo(pdfBytes, password) {
            const handle = _init();
            const ptr = allocBytes(pdfBytes);
            try {
                const rc = _readMemory(
                    handle,
                    ptr,
                    pdfBytes.length,
                    password || null,
                );
                if (rc !== 0) throwIfError(handle);

                return {
                    version: _getPdfVersion(handle),
                    pages: _getNumPages(handle),
                    encrypted: _isEncrypted(handle) !== 0,
                    linearized: _isLinearized(handle) !== 0,
                };
            } catch (e) {
                rethrowWasmError(
                    e,
                    handle,
                    "Failed to read PDF. The file may be encrypted or corrupted.",
                );
            } finally {
                Module._free(ptr);
                _cleanup(handle);
            }
        },

        /**
         * Get a metadata field from the PDF's Info dictionary.
         * @param {Uint8Array} pdfBytes
         * @param {string} key - Including leading slash, e.g. "/Author"
         * @param {string} [password]
         * @returns {string|null}
         */
        getInfoKey(pdfBytes, key, password) {
            const handle = _init();
            const ptr = allocBytes(pdfBytes);
            try {
                const rc = _readMemory(
                    handle,
                    ptr,
                    pdfBytes.length,
                    password || null,
                );
                if (rc !== 0) throwIfError(handle);
                const val = _getInfoKey(handle, key);
                return val || null;
            } catch (e) {
                rethrowWasmError(e, handle, "Failed to read PDF metadata.");
            } finally {
                Module._free(ptr);
                _cleanup(handle);
            }
        },

        /**
         * Process a PDF with the given options and return the result as a Uint8Array.
         *
         * @param {Uint8Array} pdfBytes - Input PDF bytes.
         * @param {Object} [options]
         * @param {string} [options.password] - Password for encrypted PDFs.
         * @param {boolean} [options.linearize] - Linearize (web-optimize) the output.
         * @param {boolean} [options.compress] - Compress streams (default: true).
         * @param {boolean} [options.preserveEncryption] - Preserve encryption (default: true).
         * @param {boolean} [options.deterministicId] - Use deterministic /ID.
         * @param {boolean} [options.qdfMode] - QDF mode for debugging.
         * @returns {Uint8Array} Output PDF bytes.
         */
        processPdf(pdfBytes, options = {}) {
            const handle = _init();
            const ptr = allocBytes(pdfBytes);
            try {
                // Read
                const rc = _readMemory(
                    handle,
                    ptr,
                    pdfBytes.length,
                    options.password || null,
                );
                if (rc !== 0) throwIfError(handle);

                // Set write mode to memory
                const wrc = _initWriteMemory(handle);
                if (wrc !== 0) throwIfError(handle);

                // Apply options
                if (options.linearize !== undefined)
                    _setLinearize(handle, options.linearize ? 1 : 0);
                if (options.compress !== undefined)
                    _setCompress(handle, options.compress ? 1 : 0);
                if (options.preserveEncryption !== undefined)
                    _setPreserveEnc(handle, options.preserveEncryption ? 1 : 0);
                if (options.deterministicId !== undefined)
                    _setDetId(handle, options.deterministicId ? 1 : 0);
                if (options.qdfMode !== undefined)
                    _setQdf(handle, options.qdfMode ? 1 : 0);

                // Write
                const writeRc = _write(handle);
                if (writeRc !== 0) throwIfError(handle);

                // Copy output
                const len = _getBufferLength(handle);
                const outPtr = _getBuffer(handle);
                const output = new Uint8Array(len);
                output.set(Module.HEAPU8.subarray(outPtr, outPtr + len));
                return output;
            } catch (e) {
                rethrowWasmError(
                    e,
                    handle,
                    "Failed to process PDF. The password may be incorrect or the file may be corrupted.",
                );
            } finally {
                Module._free(ptr);
                _cleanup(handle);
            }
        },

        /**
         * Check a PDF for errors.
         * @param {Uint8Array} pdfBytes
         * @param {string} [password]
         * @returns {{ ok: boolean, error: string|null }}
         */
        checkPdf(pdfBytes, password) {
            const handle = _init();
            const ptr = allocBytes(pdfBytes);
            try {
                const rc = _readMemory(
                    handle,
                    ptr,
                    pdfBytes.length,
                    password || null,
                );
                if (rc !== 0) {
                    return {
                        ok: false,
                        error: _getErrorText(handle) || "Failed to read PDF",
                    };
                }
                const checkRc = _checkPdf(handle);
                if (checkRc !== 0) {
                    return {
                        ok: false,
                        error: _getErrorText(handle) || "PDF check failed",
                    };
                }
                return { ok: true, error: null };
            } catch (e) {
                if (e instanceof Error) throw e;
                return {
                    ok: false,
                    error: "Failed to check PDF. The file may be corrupted.",
                };
            } finally {
                Module._free(ptr);
                _cleanup(handle);
            }
        },
    };
}
