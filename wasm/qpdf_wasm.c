/*
 * qpdf_wasm.c — Thin C glue for exposing qpdf functions to Emscripten/WASM.
 *
 * This file wraps the qpdf C API (qpdf-c.h / qpdfjob-c.h) so that the
 * resulting WASM module can be called directly from JavaScript via cwrap/ccall,
 * in addition to the CLI-style callMain interface.
 *
 * Compile with emcc and link against libqpdf.a, libjpeg.a, libz.a.
 */

#include <emscripten/emscripten.h>
#include <qpdf/qpdf-c.h>
#include <qpdf/qpdfjob-c.h>
#include <stdlib.h>
#include <string.h>

/* ========================================================================== */
/* Lifecycle                                                                  */
/* ========================================================================== */

EMSCRIPTEN_KEEPALIVE
qpdf_data qpdf_wasm_init(void) {
    qpdf_data qpdf = qpdf_init();
    qpdf_silence_errors(qpdf);
    return qpdf;
}

EMSCRIPTEN_KEEPALIVE
void qpdf_wasm_cleanup(qpdf_data qpdf) {
    if (qpdf) {
        qpdf_cleanup(&qpdf);
    }
}

/* ========================================================================== */
/* Read / Process                                                             */
/* ========================================================================== */

/*
 * Read a PDF from an in-memory buffer (JS passes a pointer + length).
 * Returns 0 on success, non-zero on error.
 */
EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_read_memory(qpdf_data qpdf,
                           const char* buffer,
                           unsigned long long size,
                           const char* password) {
    return (int)qpdf_read_memory(qpdf, "input.pdf", buffer, size,
                                  password ? password : "");
}

/*
 * Initialise an empty PDF (for creating from scratch).
 */
EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_empty_pdf(qpdf_data qpdf) {
    return (int)qpdf_empty_pdf(qpdf);
}

/* ========================================================================== */
/* Write                                                                      */
/* ========================================================================== */

/*
 * Prepare the qpdf object for writing to memory.
 * Returns 0 on success.
 */
EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_init_write_memory(qpdf_data qpdf) {
    return (int)qpdf_init_write_memory(qpdf);
}

/*
 * Perform the actual write.  Call qpdf_wasm_init_write_memory first,
 * then set any write parameters, then call this.
 * Returns 0 on success.
 */
EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_write(qpdf_data qpdf) {
    return (int)qpdf_write(qpdf);
}

/*
 * After a successful write-to-memory, return the buffer length.
 */
EMSCRIPTEN_KEEPALIVE
size_t qpdf_wasm_get_buffer_length(qpdf_data qpdf) {
    return qpdf_get_buffer_length(qpdf);
}

/*
 * After a successful write-to-memory, return a pointer to the buffer.
 * The caller (JS) should copy the data out before calling cleanup.
 */
EMSCRIPTEN_KEEPALIVE
const unsigned char* qpdf_wasm_get_buffer(qpdf_data qpdf) {
    return qpdf_get_buffer(qpdf);
}

/* ========================================================================== */
/* Write Parameters                                                           */
/* ========================================================================== */

EMSCRIPTEN_KEEPALIVE
void qpdf_wasm_set_compress_streams(qpdf_data qpdf, int value) {
    qpdf_set_compress_streams(qpdf, value);
}

EMSCRIPTEN_KEEPALIVE
void qpdf_wasm_set_preserve_encryption(qpdf_data qpdf, int value) {
    qpdf_set_preserve_encryption(qpdf, value);
}

EMSCRIPTEN_KEEPALIVE
void qpdf_wasm_set_linearization(qpdf_data qpdf, int value) {
    qpdf_set_linearization(qpdf, value);
}

EMSCRIPTEN_KEEPALIVE
void qpdf_wasm_set_deterministic_id(qpdf_data qpdf, int value) {
    qpdf_set_deterministic_ID(qpdf, value);
}

EMSCRIPTEN_KEEPALIVE
void qpdf_wasm_set_qdf_mode(qpdf_data qpdf, int value) {
    qpdf_set_qdf_mode(qpdf, value);
}

EMSCRIPTEN_KEEPALIVE
void qpdf_wasm_set_content_normalization(qpdf_data qpdf, int value) {
    qpdf_set_content_normalization(qpdf, value);
}

EMSCRIPTEN_KEEPALIVE
void qpdf_wasm_set_object_stream_mode(qpdf_data qpdf, int mode) {
    qpdf_set_object_stream_mode(qpdf, (enum qpdf_object_stream_e)mode);
}

EMSCRIPTEN_KEEPALIVE
void qpdf_wasm_set_stream_data_mode(qpdf_data qpdf, int mode) {
    qpdf_set_stream_data_mode(qpdf, (enum qpdf_stream_data_e)mode);
}

/* ========================================================================== */
/* Read / Query Functions                                                     */
/* ========================================================================== */

EMSCRIPTEN_KEEPALIVE
const char* qpdf_wasm_get_pdf_version(qpdf_data qpdf) {
    return qpdf_get_pdf_version(qpdf);
}

EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_get_pdf_extension_level(qpdf_data qpdf) {
    return qpdf_get_pdf_extension_level(qpdf);
}

EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_is_encrypted(qpdf_data qpdf) {
    return (int)qpdf_is_encrypted(qpdf);
}

EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_is_linearized(qpdf_data qpdf) {
    return (int)qpdf_is_linearized(qpdf);
}

EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_get_num_pages(qpdf_data qpdf) {
    return qpdf_get_num_pages(qpdf);
}

EMSCRIPTEN_KEEPALIVE
const char* qpdf_wasm_get_info_key(qpdf_data qpdf, const char* key) {
    return qpdf_get_info_key(qpdf, key);
}

EMSCRIPTEN_KEEPALIVE
void qpdf_wasm_set_info_key(qpdf_data qpdf, const char* key,
                             const char* value) {
    qpdf_set_info_key(qpdf, key, value);
}

/* ========================================================================== */
/* Permission Queries                                                         */
/* ========================================================================== */

EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_allow_extract_all(qpdf_data qpdf) {
    return (int)qpdf_allow_extract_all(qpdf);
}

EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_allow_print_high_res(qpdf_data qpdf) {
    return (int)qpdf_allow_print_high_res(qpdf);
}

EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_allow_modify_all(qpdf_data qpdf) {
    return (int)qpdf_allow_modify_all(qpdf);
}

/* ========================================================================== */
/* Error Handling                                                             */
/* ========================================================================== */

EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_has_error(qpdf_data qpdf) {
    return (int)qpdf_has_error(qpdf);
}

EMSCRIPTEN_KEEPALIVE
const char* qpdf_wasm_get_error_full_text(qpdf_data qpdf) {
    qpdf_error e = qpdf_get_error(qpdf);
    if (!e) return "";
    return qpdf_get_error_full_text(qpdf, e);
}

EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_more_warnings(qpdf_data qpdf) {
    return (int)qpdf_more_warnings(qpdf);
}

EMSCRIPTEN_KEEPALIVE
const char* qpdf_wasm_next_warning_text(qpdf_data qpdf) {
    qpdf_error w = qpdf_next_warning(qpdf);
    if (!w) return "";
    return qpdf_get_error_full_text(qpdf, w);
}

/* ========================================================================== */
/* Check PDF                                                                  */
/* ========================================================================== */

EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_check_pdf(qpdf_data qpdf) {
    return (int)qpdf_check_pdf(qpdf);
}

/* ========================================================================== */
/* QPDFJob — CLI-style interface                                              */
/* ========================================================================== */

/*
 * Run qpdf as if called from the command line, using a JSON job description.
 * Returns the exit code (0 = success).
 *
 * Example JSON:
 * {
 *   "inputFile": "/input.pdf",
 *   "outputFile": "/output.pdf",
 *   "linearize": true
 * }
 *
 * The caller is responsible for writing input files to the Emscripten
 * virtual filesystem (Module.FS) before calling this, and reading output
 * files after.
 */
EMSCRIPTEN_KEEPALIVE
int qpdf_wasm_run_job_json(const char* json) {
    return qpdfjob_run_from_json(json);
}

/* ========================================================================== */
/* Version                                                                    */
/* ========================================================================== */

EMSCRIPTEN_KEEPALIVE
const char* qpdf_wasm_version(void) {
    return qpdf_get_qpdf_version();
}
