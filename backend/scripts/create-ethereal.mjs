import nodemailer from 'nodemailer'

async function run() {
  const acc = await nodemailer.createTestAccount()
  console.log(`SMTP_HOST=${acc.smtp.host}`)
  console.log(`SMTP_PORT=${acc.smtp.port}`)
  console.log(`SMTP_USER=${acc.user}`)
  console.log(`SMTP_PASS=${acc.pass}`)
  console.log(`EMAIL_FROM="Service <${acc.user}>"`)
  console.log('\nNote: These credentials are for development/testing only. Emails do not go to real addresses.');
}

run().catch(err => { console.error(err); process.exit(1) })
