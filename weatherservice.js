import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import Hyperbee from 'hyperbee'
import fetch from 'node-fetch'
import Geohash from 'latlon-geohash'
import goodbye from 'graceful-goodbye'

const geohash = 'u628'

async function main () {
  const store = new Corestore('_cstore')
  const core = store.get({ name: 'weather-writer' })
  const db = new Hyperbee(core, {
    keyEncoding: 'utf8',
    valueEncoding: 'utf8'
  })
  await core.ready()
  await joinSwarm(core)

  async function loop () {
    await updateWeather(db, geohash)
    setTimeout(loop, 5 * 60 * 1000)
  }

  loop()
}

async function updateWeather (db, geohash) {
  console.log('Updating data')
  const { lat, lon } = Geohash.decode(geohash)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m`

  const res = await fetch(url, {
    headers: { accept: 'application/json' }
  })
  if (res.status !== 200) throw new Error('Request borked')
  const data = await res.json()
  console.log('Key:', geohash, '\nData:', data)
  await db.put(geohash, JSON.stringify(data))
}


async function joinSwarm (core) {
  await core.ready()
  const swarm = new Hyperswarm()
  goodbye(() => swarm.destroy())
  swarm.on('connection', socket => core.replicate(socket))
  const discovery = swarm.join(core.discoveryKey)
  await discovery.flushed()
  console.log('Exposed weather data on swarm key:', core.key.hexSlice())
}

main()
