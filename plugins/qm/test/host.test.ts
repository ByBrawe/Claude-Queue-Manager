import { expect, test, mock } from 'claude-code/testing'
import { initialState, enqueue } from '../src/queue.mjs'

test('official host registers Claude queue tool and protects the active turn',async($,on)=>{
  mock.clock(on);mock.store(on)
  let registered=''
  on('session.id',()=>({value:'tool-native'}))
  on('command.register',()=>({value:undefined}))
  on('tool.register',($,e)=>{registered=e.name;return{value:undefined}})
  on('session.start',()=>({cwd:'/work'}))
  on('turn.start',($,e)=>({turnId:e.turnId}))
  on('ui.log',()=>({value:undefined}))
  await $.session.start({surface:'terminal',isInteractive:true,cwd:'/work'})
  expect(registered).toBe('queue')
  await $.turn.start({turnId:'planning',text:'Make a queue'})
  const answer=await $.tool.call({tool:'mcp__qm__queue',action:'add',tasks:['Review','Test']})
  expect(JSON.parse(answer.result as string).pending.length).toBe(2)
})

// These exercise Claude's real element constructors and hook dispatch, rather
// than identity-function stand-ins for Input, Button, and Box.
for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: orphan recovery control is available above the prompt`,async($,on)=>{
    mock.clock(on)
    const saved={...enqueue(initialState('orphan-native'),['A','B']),running:{id:3,text:'Interrupted task',attempts:1},nextId:4}
    mock.store(on,{'claude-queue-manager:queue:orphan-native':saved})
    on('session.id',()=>({value:'orphan-native'}))
    on('ui.log',()=>({value:undefined}));on('ui.toast',()=>({value:undefined}));on('ui.close',()=>({value:undefined}))
    on('ui.render',()=>({type:'Text',props:{},children:[]}))
    await $.command.run({command:'qm',args:''})
    const panel=await $.ui.mount({plugin:'qm',component:'AbovePrompt',requestId:'recovery',surface,viewport:{columns:48,rows:40},props:{bodyColumns:48,hasSurvey:false}})
    expect(await panel.find({key:'qm-recovery-notice'})).toBeDefined()
    expect(await panel.find({key:'qm-toggle'})).toBeUndefined()
    await panel.press({key:'qm-recover'})
    expect(await panel.find({key:'qm-recover'})).toBeUndefined()
    expect(await panel.find({key:'qm-toggle'})).toBeDefined()
    expect(await panel.find({type:'Text',text:/3 bekleyen/})).toBeDefined()
    await panel.unmount()
  })
  for (const columns of [48, 110]) {
    test(`${surface} ${columns} columns: panel renders search and task controls`, async ($, on) => {
      mock.clock(on)
      const state = { ...enqueue(initialState('native'), ['A long task with Türkçe characters', 'Second task']), paused: true }
      mock.store(on, { 'claude-queue-manager:queue:native': state })
      on('session.id', () => ({ value: 'native' }))
      on('session.usage', () => ({ value: {context:{tokens:64000,window:200000,percent:32}} }))
      on('ui.log', () => ({ value: undefined }))
      on('ui.toast', () => ({ value: undefined }))
      on('ui.close', () => ({ value: undefined }))
      on('ui.render', () => ({ type: 'Text', props: {}, children: ['HOST_CONTENT'] }))
      await $.command.run({ command: 'qm', args: 'lang tr' })
      const props = { title: 'Queue Manager', isFocused: true, bodyColumns: columns, placement: 'inline', scroll: { offset: 0, bodyRows: 30 }, view: {} }
      const pane = await $.ui.mount({ plugin: 'qm', component: 'Pane', requestId: 'qm', surface,
        viewport: { columns, rows: 40 }, props })
      expect(await pane.find({ key: 'qm-search' })).toBeDefined()
      expect(await pane.find({type:'Text',text:/Bekleyen görev yok/})).toBeUndefined()
      if(columns<70){
        const controls=await pane.find({key:'qm-controls-1'})
        expect(controls).toBeDefined()
        expect(controls?.props.flexDirection).toBe('row')
        expect(controls?.props.flexWrap).toBe('wrap')
      }
      expect(await pane.find({ key: 'qm-add-tasks' })).toBeDefined()
      // Inline captions previously squeezed the editor to a tiny column.
      expect((await pane.find({ key: 'qm-add-tasks' }))?.props.label).toBeUndefined()
      expect(await pane.find({ key: 'qm-repeat-message' })).toBeDefined()
      expect(await pane.find({key:'qm-next-pending'})).toBeDefined()
      expect((await pane.find({key:'qm-check-1'}))?.props.hotkey).toBeUndefined()
      await pane.press({key:'qm-edit-2'})
      expect((await pane.find({key:'qm-edit-input'}))?.props.rows).toBe(10)
      expect((await pane.find({key:'qm-edit-field'}))?.props.width).toBe('100%')
      const multiline='Second task\nMore detailed instructions\nPreserve every line'
      await pane.input({key:'qm-edit-input',text:multiline,kind:'change'})
      await pane.press({key:'qm-save-edit'})
      await pane.press({key:'qm-edit-2'})
      expect((await pane.find({key:'qm-edit-input'}))?.props.value).toBe(multiline)
      await pane.press({key:'qm-cancel-edit'})
      await pane.press({ key: 'qm-details' })
      expect(await pane.find({ type:'Text',text:/32%/ })).toBeDefined()
      expect(await pane.find({key:'qm-setting-verify'})).toBeDefined()
      expect(await pane.find({key:'qm-setting-retryDelay'})).toBeDefined()
      expect(await pane.find({key:'qm-setting-timeout'})).toBeDefined()
      expect(await pane.find({key:'qm-setting-contextPercent'})).toBeDefined()
      expect(await pane.find({key:'qm-setting-onFail'})).toBeDefined()
      await pane.input({key:'qm-setting-retries',text:'2',kind:'change'})
      await pane.press({key:'qm-settings-save'})
      expect((await pane.find({key:'qm-setting-retries'}))?.props.value).toBe('2')
      await pane.press({key:'qm-settings-defaults'})
      expect((await pane.find({key:'qm-setting-retries'}))?.props.value).toBe('0')
      expect((await pane.find({ key: 'qm-repeat-message' }))?.props.label).toBeUndefined()
      await pane.press({ key: 'qm-details' })
      expect(await pane.find({ key: 'qm-rm-2' })).toBeDefined()
      await pane.input({ key: 'qm-search', text: 'Second', kind: 'change' })
      expect(await pane.find({ key: 'qm-rm-1' })).toBeUndefined()
      expect(await pane.find({ key: 'qm-rm-2' })).toBeDefined()
      await pane.unmount()
      await $.command.run({ command: 'qm', args: '' })
      const band = await $.ui.mount({ plugin: 'qm', component: 'AbovePrompt', requestId: 'band', surface,
        viewport: { columns, rows: 40 }, props: { bodyColumns: columns, hasSurvey: false } })
      expect(await band.find({ key: 'qm-close' })).toBeDefined()
      expect(await band.find({ key: 'qm-search' })).toBeDefined()
      expect(await band.find({ key: 'qm-repeat-count' })).toBeDefined()
      expect(await band.find({ key: 'qm-repeat-message' })).toBeDefined()
      expect(await band.find({ key: 'qm-repeat-action' })).toBeDefined()
      expect(await band.find({ key: 'qm-rm-2' })).toBeDefined()
      expect(await band.find({ key: 'qm-toggle' })).toBeDefined()
      expect(await band.find({ key: 'qm-undo' })).toBeDefined()
      expect(await band.find({ key: 'qm-web-open' })).toBeDefined()
      await band.press({key:'qm-details'})
      expect(await band.find({ key: 'qm-search' })).toBeDefined()
      await band.press({ key: 'qm-close' })
      expect(await band.find({ key: 'qm-add-tasks' })).toBeUndefined()
      expect(await band.find({ key: 'qm-open' })).toBeDefined()
      await band.unmount()
    })
  }
  test(`${surface}: empty queue occupies no prompt band`, async ($, on) => {
    mock.clock(on); mock.store(on)
    on('session.id', () => ({ value: 'empty-native' }))
    on('ui.log', () => ({ value: undefined }))
    on('ui.render', () => ({ type: 'Text', props: {}, children: ['HOST_CONTENT'] }))
    const band = await $.ui.mount({ plugin: 'qm', component: 'AbovePrompt', requestId: 'band', surface,
      viewport: { columns: 90, rows: 30 }, props: { bodyColumns: 90, hasSurvey: false } })
    expect(await band.find({ key: 'qm-open' })).toBeUndefined()
    expect(await band.find({ type: 'Text', text: 'HOST_CONTENT' })).toBeDefined()
    await band.unmount()
  })
}

