require('dotenv').config()
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const Joi = require('joi')
const { v4: uuidv4 } = require('uuid')
const sendGrid = require('@sendgrid/mail')
sendGrid.setApiKey(process.env.SENDGRID_API_KEY);
const bcrypt = require('bcrypt');
const saltRounds = 10;
const axios = require('axios')
const authorization = require('./authorization')

let customerStore = [
    // {
    //    id:
    //    lastname:
    //    firstname:
    //    email:
    //    phone:
    //    password:
    //    registeredData
    // }
]
const otpStore = [
    // {
    //    id:
    //    otp:
    //    email:
    //    date
    // }
]
const jobApplicationStore = [
    // {
    //    fullname: "",
    //    address: "",
    //    email: ""
    //    jobId: ""
    //    yearsOfExperiece: "",
    //    qualifications: "",
    //    status: 
 
    // }
]
 
app.use(bodyParser.json())

app.get('/', (req, res) => { 

    res.status(200).json({
        status : true,
        message: 'Welcome to my API'
    })
})

app.post('/register', async(req, res) => { 
 
    const { lastname, firstname, email, phone, password } = req.body

    const RegisterSchema = Joi.object({
        lastname: Joi.string().required().min(3),
        firstname: Joi.string().required(),
        email: Joi.string().email().required(),
        phone: Joi.string().required(),
        password: Joi.string().required()
    })

    const { value, error } = RegisterSchema.validate(req.body)
    if (error != undefined) { 
        res.status(400).json({
            status: false,
            message: error.details[0].message
        })

        return
    }

    const isEmailOrPhoneRegistered = customerStore.find(customer => customer.email === email || customer.phone === phone)
   
    if (isEmailOrPhoneRegistered) { 
        res.status(400).json({
            status: false,
            message: 'Email or Phone already registered'
        })
        return 
    }

    const responseSalt = await bcrypt.genSalt(saltRounds)
    if (!responseSalt) {
        res.status(500).json({
            status: false,
            message: 'Sorry , we cannot create account this time, try again later'
        })
        return
    }
    const responseHash  = await bcrypt.hash(password, responseSalt)
    if (!responseHash) {
        res.status(500).json({
            status: false,
            message: 'Sorry , we cannot create account this time, try again later'
        })
        return
    }
    const customer = {
                id: uuidv4(),
                lastname,
                firstname,
                email,
                phone,
                salt: responseSalt,
                password: responseHash,
                status: "in-active",
                registeredDate: new Date()
    }

    customerStore.push(customer)
    
    
    const otp = generateOtp()
    const tempOtp = {
        id: uuidv4(),
        otp,
        email,
        date: new Date()
    }

    otpStore.push(tempOtp)
    // send otp to email
    sendEmail(email, 'OTP Verification', `Hi ${firstname}, Your OTP is ${otp}. Kindly note that this OTP expires in 5 minutes.`,)

    res.status(201).json({
        status: true,
        message: 'An otp has been sent to your email, use that to complete your registration',
        data: customerStore
    })

})

app.get('/verify/:email/:otp', (req, res) => {
    const { email, otp } = req.params
    if(!email || !otp) { 
        res.status(400).json({
            status: false,
            message: 'Email and OTP are required'
        })
        return
    }

    const customer = otpStore.find(data => data.email === email && data.otp == otp )
  
    if (!customer) { 
        res.status(400).json({
            status: false,
            message: 'Invalid OTP',
            customer: customer
        })
        return
    }
    //check otp expiration time
    const timeDifference = new Date() - new Date(customer.date)
    const timeDifferenceInMinutes = Math.ceil(timeDifference / (1000 * 60))
    if (timeDifferenceInMinutes > 5) {
        res.status(400).json({
            status: false,
            message: 'OTP expired'
        })
        return
    }

    const newCustomerStore = customerStore.map(data => {
        if (data.email === email) {
           data.status  = "active"
        }
        return data
    })

    customerStore = [...newCustomerStore]
    sendEmail(email, 'Registration Successful', `Hi, We arev happy to have you onboard. Let do some awesome stuffs together`,)
    res.status(200).json({
        status: true,
        message: 'OTP verified successfully'
    })
    
})
 

app.get('/resend-otp/:email', (req, res) => { 
    const { email } = req.params
    if (!email) {
        res.status(400).json({
            status: false,
            message: 'Email is required'
        })
        return
    }

    const customer = customerStore.find(data => data.email === email)
    if (!customer) { 
        res.status(400).json({
            status: false,
            message: 'Invalid email'
        })
        return
    }
    const otp = generateOtp()
    const tempOtp = {
        id: uuidv4(),
        otp,
        email,
        date: new Date()
    }

    otpStore.push(tempOtp)
    //ssend email
    sendEmail(email, 'Resend OTP ', `Hi ${firstname}, Your new OTP is ${otp}. Kindly note that this OTP expires in 5 minutes.`,)
    
    res.status(200).json({
        status: true,
        message: "Otp resent successfully"
    })

})


app.post('/login', async(req, res) => {

    const { emailOrPhone, password } = req.body

    const LoginSchema = Joi.object({
        emailOrPhone: Joi.string().required(),
        password: Joi.string().required()
    })

    const { value, error } = LoginSchema.validate(req.body)
    if (error != undefined) {
        res.status(400).json({
            status: false,
            message: error.details[0].message
        })

        return
    }

    const customer = customerStore.find(data => data.email === emailOrPhone || data.phone === emailOrPhone)
    if (!customer) {
        res.status(400).json({
            status: false,
            message: 'Invalid email or password'
        })
        return
    }
   
    const responseHash = await bcrypt.hash(password, customer.salt)
    if (!responseHash) {
        res.status(500).json({
            status: false,
            message: 'Sorry , you canaot login this time, try again later'
        })
        return
    }

    if (responseHash !== customer.password) {
        res.status(400).json({
            status: false,
            message: 'Invalid email or password'
        })
        return
    }

    if (customer.status !== 'active') {
        res.status(400).json({
            status: false,
            message: 'Account not verified, Kindly go verify your accoiunt'
        })
        return
    }


    res.status(200).json({
        status: true,
        message: 'Login successful'
    })

})
 

app.get('/jobs', async (req, res) => {

    const { apikey } = req.headers
    const length = req.query.length || 10
    const category = req.query.category || ''
    const company = req.query.company || ''

    const response = authorization(apikey)
    if (!response) {
        res.status(401).json({
            status: false,
            message: 'Unauthorized'
        })
        return
    }

    const result = await axios({
        method: "get",
        url: `${process.env.REMOTE_API_BASEURL}/remote-jobs?limit=${length}&category=${category}&company_name=${company}`
    })
 
    res.status(200).json({
        status: true,
        count: result.data.jobs.length,
        data: result.data.jobs
    })


    // fetch('https://remotive.com/api/remote-jobs')
    // .then(response => response.json())
    // .then(data => {
    //     res.status(200).json({
    //         status: true,
    //         data: data.jobs
    //     })
    // })



 })


app.get('/jobs/categories', async(req, res) => {

    const result = await axios({
        method: 'get',
        url: `${process.env.REMOTE_API_BASEURL}/remote-jobs`
    })
  

    // const response1 = await axios({
    //     method: "get",
    //     url: "https://remotive.com/api/remote-jobs",

    // })

   const jobCategories = result.data.jobs.map(item => item.category)

    res.status(200).json({
        status: true,
        data: jobCategories
    })



})
 
app.post('/job/apply', (req, res) => {

     const applySchema = Joi.object({
        fullname: Joi.string().required().min(4),
        address: Joi.string().required().min(10),
        email: Joi.string().email().required(),
        jobId : Joi.string().required(),
        yearsOfExperiece: Joi.number().required(),
        qualifications : Joi.string().required().valid('SSCE', 'BSC', 'MSC')
     })
    
    const { value, error } = applySchema.validate(req.body)

    if (error !== undefined) {
        res.status(400).json({
            status: false,
            message: error.details[0].message
        })
        return
    }
    
    const { fullname, address, email, jobId, yearsOfExperiece, qualifications } = req.body
    const job = {
        id: uuidv4(),
        fullname,
        address,
        email,
        jobId,
        yearsOfExperiece,
        qualifications,
        status: 'submitted',
        date: new Date()
    }

    jobApplicationStore.push(job)

    res.status(200).json({
        status: true,
        message: 'Job application submitted successfully'
    })


})


app.get('/admin/customers', (req, res) => { 
    
    const { apikey } = req.headers
    const response = authorization(apikey)
    if (!response) {
        res.status(401).json({
            status: false,
            message: 'Unauthorized'
        })
        return
    }

        res.status(200).json({
            status: true,
            data: customerStore
        })
})






const generateOtp = () => {
    return  Math.floor(100000 + Math.random() * 900000)
}

const sendEmail = (email, subject, message) => {
    const msg = {
        to: email,
        from: process.env.EMAIL_SENDER, // Use the email address or domain you verified above
        subject: subject,
        text:message,
       };
    sendGrid
        .send(msg)
        .then(() => { })
        .catch((error) => { })
   
}
app.listen(process.env.PORT, () => {

    console.log(`Server is running on port ${process.env.PORT}`)


 })