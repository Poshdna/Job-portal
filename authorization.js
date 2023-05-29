const authorization = (apikey) => { 

    if (!apikey || apikey !== process.env.API_KEY) { 
        return false
    }
    return true
}

module.exports = authorization