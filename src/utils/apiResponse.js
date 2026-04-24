
class apiResponse {
    constructor(statusCode,message, data,success=true) {
        this.statusCode = statusCode || 200
        this.message = message
        this.data = data || null
        this.success = success 
    }
}

export default apiResponse
