import { LookerEmbedSDK, LookerEmbedDashboard } from '../src/index'
import { looker_host, dashboard_id, dashboard_state_filter, query_object, query_field_name, dashboard_date_filter, query_date_filter, logoUrl, query_calculation } from './demo_config'
import { LookerSDK, IApiSettings, AuthToken, IError, CorsSession } from '@looker/sdk'
import { LookerDashboardOptions } from '../src/types'
import { swap_element, new_vis_config } from './demo_config'
import { dashbord_layout_filter } from './demo_config'

const user = require('./demo_user.json')

LookerEmbedSDK.init(looker_host, '/auth')
document.addEventListener('DOMContentLoaded', ()=> {
  const dashboard = localStorage.getItem('dashboard') || dashboard_id
  embedSdkInit(dashboard)
})

let sdk: LookerSDK
let gDashboard: LookerEmbedDashboard
let gOptions: LookerDashboardOptions
class EmbedSession extends CorsSession {
  async getToken() {
    console.log(document.location)
    const token = await sdk.ok(sdk.authSession.transport.request<AuthToken,IError>('GET', `${document.location.origin}/token`  ))
    return token
  }
}

const session = new EmbedSession({
  base_url: `https://${looker_host}:19999`,
  api_version: '3.1'
} as IApiSettings)
sdk = new LookerSDK(session)

const setupDashboard = async (dashboard: LookerEmbedDashboard) => {
  gDashboard = dashboard
  const dropdown = document.getElementById('select-dropdown')
  if (dropdown) {
    dropdown.addEventListener('change', (event) => { 
      dashboard.updateFilters({ [dashboard_state_filter]: (event.target as HTMLSelectElement).value })
      dashboard.run()
      const last_filters = JSON.parse(localStorage.getItem('dashboard_filters') || '{}');
      localStorage.setItem('dashboard_filters', JSON.stringify(Object.assign(last_filters, { [dashboard_state_filter]: (event.target as HTMLSelectElement).value })))
      changeTitles(gOptions.elements,(event.target as HTMLSelectElement).value)
    })
  }

  const me = await sdk.ok(sdk.me())
  console.log(me)
  const states = await sdk.ok(sdk.run_inline_query( 
    { 
      body: query_object,
      result_format: 'json'
    }
  ))
  addStateOptions(states)
  loadingIcon(false)
  const table_icon = document.getElementById('table-swap')
  if (table_icon) {
    table_icon.addEventListener('click', () => {
      tableChange(table_icon)
    })
  }
  const donut_icon = document.getElementById('vis-swap')
  if (donut_icon) {
    donut_icon.addEventListener('click', () => {
      swapVisConfig(donut_icon)
    })
  }
  addDashboardOptions()
}

function embedSdkInit ( dashboard_id: any ) {
  const logo = document.getElementById('logo')
  const last_filters = JSON.parse(localStorage.getItem('dashboard_filters') || '{}');
  if (logo) { logo.setAttribute('src',logoUrl)}
  if (dashboard_id) {
    LookerEmbedSDK.createDashboardWithId(dashboard_id)
      .appendTo('#dashboard')
      .withClassName('looker-embed')
      .withFilters(last_filters)
      .withTheme( 'sko' )
      .on('page:property:change', changeHeight ) // dashboards-next
      // .on('page:properties:changed', changeHeight ) // dashboards
      .on('dashboard:filters:changed', filtersUpdates)
      // .withNext()
      .on('dashboard:loaded', loadEvent)
      .on('drillmenu:click', drillClick)
      .build()
      .connect()
      .then(setupDashboard)
      .catch((error: Error) => {
        console.error('Connection error', error)
      })
  } else {
    document.querySelector<HTMLDivElement>('#demo-dashboard')!.style.display = 'none'
  }
}

async function filtersUpdates( event: any ) {
  loadingIcon(true);
  console.log(event)
  // instantiate elements, filters, and query objects
  const dashboard_filters: any = (event && event.dashboard && event.dashboard.dashboard_filters) ? event.dashboard && event.dashboard.dashboard_filters : undefined
  let dropdown = document.getElementById('select-dropdown')
  let new_filters = query_object.filters

  // update query object and run query
  if (dashboard_filters && ( dashboard_date_filter in dashboard_filters ) ) { // check to make sure our filter is in the changed
    if (dropdown) { // check to make sure we found our elements to update/keep
      new_filters = Object.assign(new_filters, { [query_date_filter]: dashboard_filters[dashboard_date_filter] })
      const states = await sdk.ok(sdk.run_inline_query( 
        { 
          body: Object.assign(query_object, { filters: new_filters }),
          result_format: 'json'
        }
      ))
      addStateOptions(states)
    }
  }
  loadingIcon(false)
  if (dashboard_filters && dashboard_filters[dashbord_layout_filter] && dashboard_filters[dashbord_layout_filter]) {
    layoutFilter(dashboard_filters[dashbord_layout_filter])
  }

  if (dashboard_filters) {
    localStorage.setItem('dashboard_filters', JSON.stringify(dashboard_filters));
  }
}

function changeHeight( event: any ) {
  console.log(event)
  const div = document.getElementById('dashboard')
  if (event && event.height && div) {
    div.style.height = `${event.height+20}px`
  }
}

function addStateOptions(data: any) {
  const dropdown = document.getElementById('dropdown-menu')
  if (dropdown && data && data.length > 1) {
    data.forEach(function (row: any, i: number) {
      if (query_field_name && row[query_field_name]) {
        // create new option: replaced with function for more complex dropdown
        const new_option = dropdownItem(row, i)
        // replace or create the dropdown item
        if (dropdown.children[i+1]) {
          dropdown.children[i+1].replaceWith(new_option)
        } else {
          dropdown.appendChild(new_option)
        } 
      }
    })
  }
}


function dropdownItem (row: any, i: number) {
  const item = document.createElement('div')
  item.setAttribute('data-value',row[query_field_name])
  item.classList.add('item')
  const options = (row[query_calculation] > 0) ? ['green','▲'] : (row[query_calculation] < 0) ? ['red','▼'] : ['black','']
  const format = Number(row[query_calculation]).toLocaleString(undefined,{ style: 'percent', minimumFractionDigits: 2 })
  item.innerHTML = `<span>${i+1}) ${row[query_field_name]}</span><span style='float: right;'><font color="${options[0]}">${options[1]} ${format}</font></span>`
  return item
}

function loadingIcon (loading: boolean) {
  const loader = document.getElementById('dropdown-icon-loader')
  const icon = document.getElementById('dropdown-icon')
  if (loader && icon) {
    icon.style.display = (loading) ? 'none' : ''
    loader.style.display = (loading) ? '' : 'none'
  }
}

function loadEvent (event: any) {
  console.log('dashboard:loaded', event)
  if (event && event.dashboard && event.dashboard.options ) {
    gOptions = event.dashboard.options
    console.log('OPTIONS', gOptions)
  }
  if (event && event.dashboard && event.dashboard.dashboard_filters) {
    const dashboard_filters = event.dashboard.dashboard_filters
    if (dashboard_filters && dashboard_filters[dashbord_layout_filter] && dashboard_filters[dashbord_layout_filter]) {
      layoutFilter(dashboard_filters[dashbord_layout_filter])
    }
  }
}

function changeTitles(elements: any, state: string) {
  const add_state = (state && state !== '') ? ` (${state})` : ''
  const new_elements = JSON.parse(JSON.stringify(elements))
  Object.keys(new_elements).forEach(el=>{
    console.log(new_elements[el].vis_config.title )
    if (new_elements[el].vis_config.type == "single_value") {
      new_elements[el].vis_config.title = new_elements[el].vis_config.title + add_state
      new_elements[el].title = ""
    } else {
      new_elements[el].title = new_elements[el].vis_config.title + add_state
    }
  })
  gDashboard.setOptions({elements: new_elements})
}

function tableChange(table_icon: HTMLElement) {
  let new_elements = JSON.parse(JSON.stringify(gOptions.elements))
  const to_table = ( table_icon.getAttribute('data-value') == '0' ) ? true : false
  table_icon.classList.remove((to_table) ? 'black' : 'violet')
  table_icon.classList.add((to_table) ? 'violet' : 'black')
  table_icon.setAttribute('data-value', (to_table) ? '1': '0')
  if (to_table) {
    Object.keys(new_elements).forEach(element => {
      if (new_elements[element].vis_config.type !== 'single_value' ) {
        new_elements[element].vis_config.type = 'looker_grid'
      }
    })
    gDashboard.setOptions({ elements: new_elements})
  } else {
    gDashboard.setOptions({ elements: gOptions.elements })
  }
}

function swapVisConfig( icon: HTMLElement ) {
  if ( swap_element && gOptions && gOptions.elements && gOptions.elements[swap_element] ) {
    const elements = JSON.parse(JSON.stringify( gOptions.elements ))
    const to_original = (icon.getAttribute('data-value') === '1') ? true : false
    icon.classList.remove((to_original) ? 'black' : 'violet')
    icon.classList.add((to_original) ? 'violet' : 'black')
    icon.setAttribute('data-value', (to_original) ? '0': '1')

    if (to_original) {
      let new_element = { [swap_element]: elements[swap_element] }
      new_element[swap_element]['vis_config'] = Object.assign( new_element[swap_element]['vis_config'],  new_vis_config  )
      gDashboard.setOptions({ elements: new_element})
    } else {
      gDashboard.setOptions({ elements: gOptions.elements })
    }
  }
}

function layoutFilter(filter: any) {
  const copy_options = JSON.parse(JSON.stringify(gOptions))
  const elements = copy_options.elements || {}
  const layout = copy_options.layouts[0]
  let components = (layout.dashboard_layout_components) ? layout.dashboard_layout_components : []

  const new_components: any = []
  filter = filter.split(',')

  components.forEach((c: any )=>{
    const found = elements[c.dashboard_element_id]
    if (filter.indexOf(found.title) > -1 ) {
      new_components.push(c)
    }
  })
  layout.dashboard_layout_components = new_components
  gDashboard.setOptions({ layouts: [layout] })
}

function drillClick ( event: any) {
  console.log('drillmenu:click', event)
  if (event && event.modal) {
    const dashboard_div = document.getElementById('dashboard')
    if ( dashboard_div ) {
      if (dashboard_div.children.length > 1 && dashboard_div.lastChild) {
        dashboard_div.lastChild.remove()
      }

      const url = new URL(`https://${looker_host}${event.url}`)
      const path_split = url.pathname.split('/')
      const query_params: any = {}
      url.search.slice(1).split('&').forEach(h=>{
        const hash = h.split('=')
        query_params[hash[0]] = url.searchParams.get(hash[0])
      })
      console.log(query_params)
      console.log('Click URL', url)
      sdk.get(`/queries/models/${path_split[3]}/views/${path_split[4]}/run/csv${url.search}&limit=-1`)
      .then((data: any) => {
        var rows = data.value.split('\n'),
        table = document.createElement('table'),
        tr = null, td = null,
        tds = null;

        table.className = "ui celled table"

        for ( var i = 0; i < rows.length; i++ ) {
            tr = document.createElement('tr');
            tds = rows[i].split(',');
            for ( var j = 0; j < tds.length; j++ ) {
              td = document.createElement('td');
              td.innerHTML = tds[j];
              tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        dashboard_div.appendChild(table)
    })
  }
    return {cancel: true}
  } else {
    return {cancel: false}
  }
}

async function addDashboardOptions () {
  const dashboard_dropdown_parent = document.getElementById('select-dashboard')
  if (dashboard_dropdown_parent) {
    dashboard_dropdown_parent.addEventListener('change', (event: any) => {
      const dashboard_div = document.getElementById('dashboard')
      if (dashboard_div) {
        dashboard_div.firstChild!.remove()
        embedSdkInit( (event.target as HTMLSelectElement).value )
      }
      localStorage.setItem('dashboard', (event.target as HTMLSelectElement).value )
    })
    
    
  }
  const dropdown = document.getElementById('dashboard-dropdown-menu')
  let dashboards = await sdk.ok(sdk.all_dashboards())
  dashboards = dashboards.sort((a,b) => {
    if (a.title!.toLowerCase() > b.title!.toLowerCase() ) { return 1 }
    if (a.title!.toLowerCase() < b.title!.toLowerCase() ) { return -1 }
    return 0
  })
  if (dropdown && dashboards && dashboards.length > 1) {
    dashboards.forEach(function (db: any, i: number) {
      dropdown.appendChild(dashboardItem(db))
    })
  }
}

function dashboardItem (db: any) {
  const dropdown_item = document.createElement('div')
  dropdown_item.classList.add('item')
  dropdown_item.setAttribute('data-value', db.id)
  dropdown_item.innerHTML = `${db.title}`
  return dropdown_item
}
