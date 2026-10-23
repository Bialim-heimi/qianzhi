'use strict';
// A gentle forward/back cycle: three alternating acceleration peaks, then settling.
(function(){
class RockingDetector {
  constructor(){this.reset();}
  reset(){this.phase=0;this.sign=0;this.started=0;this.neutral=null;this.until=0;}
  feed(z,time){
    if(!Number.isFinite(z)||!Number.isFinite(time)||time<this.until)return false;
    if(this.phase&&time-this.started>2400)this.reset();
    const sign=z>1.3?1:z< -1.3?-1:0;
    if(this.phase===0){if(sign){this.sign=sign;this.started=time;this.phase=1;}return false;}
    if(this.phase===1&&sign===-this.sign){this.phase=2;return false;}
    if(this.phase===2&&sign===this.sign){if(time-this.started<300){this.reset();return false;}this.phase=3;return false;}
    if(this.phase===3){
      if(Math.abs(z)<=.55){
        if(this.neutral===null)this.neutral=time;
        if(time-this.neutral>=100&&time-this.started>=400){this.reset();this.until=time+350;return true;}
      }else this.neutral=null;
    }
    return false;
  }
}
window.QianRockingDetector=RockingDetector;
})();
