function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

function syncHandler(fn) {
    return (req, res, next) => {
        try {
            fn(req, res, next);
        } catch (err) {
            next(err);
        }
    };
}

module.exports = { asyncHandler, syncHandler };