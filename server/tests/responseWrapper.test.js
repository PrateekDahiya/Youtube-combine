const { test } = require("node:test");
const assert = require("node:assert");
const {
    successResponse,
    errorResponse,
    validationErrorResponse,
    notFoundResponse,
    unauthorizedResponse,
    forbiddenResponse,
    sendResponse,
} = require("../src/utils/responseWrapper");

test("successResponse builds a success envelope", () => {
    const result = successResponse({ id: 1 }, "API ran successfully", 200);
    assert.equal(result.success, true);
    assert.deepEqual(result.data, { id: 1 });
    assert.equal(result.message, "API ran successfully");
    assert.equal(result.statusCode, 200);
});

test("successResponse uses defaults", () => {
    const result = successResponse(null);
    assert.equal(result.success, true);
    assert.equal(result.data, null);
    assert.equal(result.message, "API ran successfully");
    assert.equal(result.statusCode, 200);
});

test("errorResponse builds a failure envelope without leaking internals", () => {
    const result = errorResponse("Something failed", 500, null);
    assert.equal(result.success, false);
    assert.equal(result.data, null);
    assert.equal(result.message, "Something failed");
    assert.equal(result.statusCode, 500);
});

test("validationErrorResponse defaults to 400", () => {
    const result = validationErrorResponse("Invalid input");
    assert.equal(result.success, false);
    assert.equal(result.message, "Invalid input");
    assert.equal(result.statusCode, 400);
});

test("notFoundResponse defaults to 404", () => {
    const result = notFoundResponse("Missing");
    assert.equal(result.success, false);
    assert.equal(result.message, "Missing");
    assert.equal(result.statusCode, 404);
});

test("unauthorizedResponse defaults to 401", () => {
    const result = unauthorizedResponse();
    assert.equal(result.success, false);
    assert.equal(result.statusCode, 401);
});

test("forbiddenResponse defaults to 403", () => {
    const result = forbiddenResponse("Forbidden");
    assert.equal(result.success, false);
    assert.equal(result.message, "Forbidden");
    assert.equal(result.statusCode, 403);
});

test("sendResponse strips statusCode from body and sets HTTP status", () => {
    const status = { code: null };
    const sent = [];
    const res = {
        status(code) {
            status.code = code;
            return this;
        },
        json(body) {
            sent.push(body);
            return this;
        },
    };

    sendResponse(res, successResponse({ ok: true }, "ok", 200));

    assert.equal(status.code, 200);
    assert.equal(sent[0].success, true);
    assert.equal(sent[0].data.ok, true);
    assert.equal(sent[0].statusCode, undefined);
});

test("sendResponse sends failure messages with correct HTTP status and no data leakage", () => {
    const status = { code: null };
    const sent = [];
    const res = {
        status(code) {
            status.code = code;
            return this;
        },
        json(body) {
            sent.push(body);
            return this;
        },
    };

    sendResponse(res, errorResponse("Database error", 500));

    assert.equal(status.code, 500);
    assert.equal(sent[0].success, false);
    assert.equal(sent[0].data, null);
    assert.equal(sent[0].message, "Database error");
    assert.equal(sent[0].statusCode, undefined);
});
