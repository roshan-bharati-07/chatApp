const errorMiddleware = (err, req, res, next) => {
    console.log("Error middleware", err.message);
    
    const statusCode = err.statusCode || 500;

    console.log("Error middleware - status code", statusCode);

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        errors: err.errors || [],
        data: null
    });
};

export default errorMiddleware;


// throw new apiError creates new apiError object
//  to send api Error as JSON
// asyncHandler directly passes error to next()
// if !errorMiddleware => frontend won't get apiError
