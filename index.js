require('dotenv').config()
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const Joi = require('joi')
const { v4: uuidv4 } = require('uuid')
const sendGrid = require('@sendgrid/mail')
sendGrid.setApiKey(process.env.SENDGRID_API_KEY);


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
app.use(bodyParser.json())

app.get('/', (req, res) => { 

    res.status(200).json({
        status : true,
        message: 'Welcome to my API'
    })
})

app.post('/register', (req, res) => { 
 
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

    const customer = {
                id: uuidv4(),
                lastname,
                firstname,
                email,
                phone,
                password,
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


app.get('/customers', (req, res) => { 
    
    const { apikey } = req.headers
    if (!apikey || apikey !== process.env.API_KEY) {
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