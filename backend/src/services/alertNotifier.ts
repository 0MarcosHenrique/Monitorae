import axios from 'axios'
import nodemailer from 'nodemailer'
import { prisma } from '../lib/prisma'

type AlertType = 'DOWN' | 'UP_AGAIN' | 'HIGH_LATENCY' | 'SSL_EXPIRING'
type AlertChannel = 'EMAIL' | 'DISCORD' | 'TELEGRAM'

type AlertInput = {
  endpointId: string
  type: AlertType
  message: string
}

const getConfiguredChannels = (): AlertChannel[] => {
  const raw = process.env.ALERT_CHANNELS || ''

  return raw
    .split(',')
    .map((channel) => channel.trim().toUpperCase())
    .filter((channel): channel is AlertChannel =>
      ['EMAIL', 'DISCORD', 'TELEGRAM'].includes(channel),
    )
}

const sendDiscordAlert = async (message: string) => {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL

  if (!webhookUrl) {
    return false
  }

  await axios.post(webhookUrl, {
    content: message,
  })

  return true
}

const sendTelegramAlert = async (message: string) => {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    return false
  }

  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text: message,
  })

  return true
}

const sendEmailAlert = async (message: string) => {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.ALERT_EMAIL_FROM
  const to = process.env.ALERT_EMAIL_TO

  if (!host || !user || !pass || !from || !to) {
    return false
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  })

  await transporter.sendMail({
    from,
    to,
    subject: 'Monitorae alert',
    text: message,
  })

  return true
}

const sendAlert = async (channel: AlertChannel, message: string) => {
  if (channel === 'DISCORD') {
    return sendDiscordAlert(message)
  }

  if (channel === 'TELEGRAM') {
    return sendTelegramAlert(message)
  }

  return sendEmailAlert(message)
}

export const createAndDispatchAlerts = async ({ endpointId, type, message }: AlertInput) => {
  const configuredChannels = getConfiguredChannels()
  const channels = configuredChannels.length > 0 ? configuredChannels : ['EMAIL' as AlertChannel]

  for (const channel of channels) {
    const alert = await prisma.alert.create({
      data: {
        endpointId,
        type,
        channel,
        message,
      },
    })

    try {
      const sent = await sendAlert(channel, message)

      if (sent) {
        await prisma.alert.update({
          where: { id: alert.id },
          data: {
            sent: true,
            sentAt: new Date(),
          },
        })
      }
    } catch (error) {
      console.error(`[ALERT] Failed to send ${channel} alert`, error)
    }
  }
}
