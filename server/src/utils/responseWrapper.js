function successResponse(data, message = "API ran successfully", statusCode = 200) {
    return {
        success: true,
        data,
        message,
        statusCode
    };
}

function errorResponse(message = "An error occurred", statusCode = 500, data = null) {
    return {
        success: false,
        data,
        message,
        statusCode
    };
}

function validationErrorResponse(message = "Validation failed", statusCode = 400, data = null) {
    return {
        success: false,
        data,
        message,
        statusCode
    };
}

function notFoundResponse(message = "Resource not found", statusCode = 404, data = null) {
    return {
        success: false,
        data,
        message,
        statusCode
    };
}

function unauthorizedResponse(message = "Unauthorized", statusCode = 401, data = null) {
    return {
        success: false,
        data,
        message,
        statusCode
    };
}

function forbiddenResponse(message = "Forbidden", statusCode = 403, data = null) {
    return {
        success: false,
        data,
        message,
        statusCode
    };
}

function sendResponse(res, response) {
    const { statusCode, ...body } = response;
    return res.status(statusCode).json(body);
}

module.exports = {
    successResponse,
    errorResponse,
    validationErrorResponse,
    notFoundResponse,
    unauthorizedResponse,
    forbiddenResponse,
    sendResponse
};