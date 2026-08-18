window.INVENTORY_DATA=(window.INVENTORY_DATA||[]).concat([
{"i":"P-000195","p":"VEX","n":"V5 Robot Battery Li-Ion","m":"VEX Robotics","x":"276-4811","c":"Power","g":"https://content.vexrobotics.com/docs/276-4811-v5-battery.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000196","p":"VEX","n":"V5 Robot Battery Charger","m":"VEX Robotics","x":"276-4812","c":"Power","g":"https://content.vexrobotics.com/docs/276-4812-v5-charger.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000197","p":"VEX","n":"V5 Smart Cable Stock (50 ft)","m":"VEX Robotics","x":"276-4815","c":"Electronics","g":"https://content.vexrobotics.com/docs/276-4815-v5-cable-stock.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000198","p":"VEX","n":"V5 Smart Cable Crimping Tool","m":"VEX Robotics","x":"276-4832","c":"Tools","g":"https://content.vexrobotics.com/docs/276-4832-crimp-tool.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000199","p":"VEX","n":"V5 System Bundle","m":"VEX Robotics","x":"276-7000","c":"Kits","g":"https://content.vexrobotics.com/docs/276-7000-v5-system-bundle.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000200","p":"VEX","n":"V5 Competition Starter Kit","m":"VEX Robotics","x":"276-7010","c":"Kits","g":"https://content.vexrobotics.com/docs/276-7010-v5-starter-kit.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000201","p":"VEX","n":"V5 Competition Super Kit","m":"VEX Robotics","x":"276-7020","c":"Kits","g":"https://content.vexrobotics.com/docs/276-7020-v5-super-kit.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000202","p":"VEX","n":"VEX ARM Cortex-based Microcontroller","m":"VEX Robotics","x":"276-2194","c":"Electronics","g":"https://content.vexrobotics.com/docs/276-2194-cortex.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Retired","iv":0},
{"i":"P-000203","p":"VEX","n":"VEXnet Joystick","m":"VEX Robotics","x":"276-2192","c":"Electronics","g":"https://content.vexrobotics.com/docs/276-2192-joystick.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Retired","iv":0},
{"i":"P-000204","p":"VEX","n":"VEXnet Key 2.0","m":"VEX Robotics","x":"276-3245","c":"Electronics","g":"https://content.vexrobotics.com/docs/276-3245-vexnet-key.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Retired","iv":0},
{"i":"P-000205","p":"VEX","n":"VEX 2-Wire Motor 393","m":"VEX Robotics","x":"276-2181","c":"Motion","g":"https://content.vexrobotics.com/docs/276-2181-motor-393.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Retired","iv":0},
{"i":"P-000206","p":"VEX","n":"Motor Controller 29","m":"VEX Robotics","x":"276-2193","c":"Electronics","g":"https://content.vexrobotics.com/docs/276-2193-mc29.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Retired","iv":0},
{"i":"P-000207","p":"VEX","n":"VEX Robot Battery NiMH 7.2V 3000mAh","m":"VEX Robotics","x":"276-2177","c":"Power","g":"https://content.vexrobotics.com/docs/276-2177-battery.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Retired","iv":0}
]);

// Frontend persistence shim. The main page defines setPartFlag/saveLocalFlags later;
// wrap them after load so a deliberate toggle survives refresh immediately,
// while the Apps Script backend remains the authoritative persistent store.
window.addEventListener('load',function(){
  if(typeof window.setPartFlag==='function'&&typeof window.saveLocalFlags==='function'){
    const originalSetPartFlag=window.setPartFlag;
    window.setPartFlag=function(partId,flag,enabled,event){
      originalSetPartFlag.call(this,partId,flag,enabled,event);
      const x=(window.INVENTORY_DATA||[]).find(function(item){return item.i===partId;});
      if(x) window.saveLocalFlags(x);
    };
  }

  function applyBridgePayload(data){
    if(!data||data.source!=='robotics-inventory-backend') return;
    if(data.type==='part-flag-updated'&&data.ok){
      const x=(window.INVENTORY_DATA||[]).find(function(item){return item.i===data.partId;});
      if(x&&typeof window.setLocalFlag==='function'&&typeof window.saveLocalFlags==='function'){
        window.setLocalFlag(x,'RETIRED',!!data.flags.retired);
        window.setLocalFlag(x,'UNAVAILABLE',!!data.flags.unavailable);
        window.setLocalFlag(x,'NOT_INVENTORIED',!!data.flags.notInventoried);
        window.saveLocalFlags(x);
        if(typeof window.render==='function') window.render();
        if(window.selectedItem&&window.selectedItem.i===data.partId&&typeof window.refreshDetail==='function') window.refreshDetail();
      }
    }
  }

  window.addEventListener('storage',function(e){
    if(e.key!=='roboticsInventoryBridgeEvent'||!e.newValue) return;
    try{const envelope=JSON.parse(e.newValue);applyBridgePayload(envelope.payload||null);}catch(err){}
  });

  try{
    const channel=new BroadcastChannel('robotics-inventory');
    channel.onmessage=function(e){applyBridgePayload(e.data||null);};
  }catch(err){}
});
