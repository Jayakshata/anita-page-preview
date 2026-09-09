// Mixamo walk → her VRoid rig, retargeted live in the browser.
// Both skeletons stand in a T-pose facing +Z, so each Mixamo bone's change of world orientation since its T-pose
// can be applied straight onto the matching bone of hers: herWorld = (mixNow · mixRest⁻¹) · herRestWorld.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// mixamorig name → J_Bip name. Fingers are left to the standing pose on purpose.
export const MAP = {
  Hips: 'J_Bip_C_Hips', Spine: 'J_Bip_C_Spine', Spine1: 'J_Bip_C_Chest', Spine2: 'J_Bip_C_UpperChest', Neck: 'J_Bip_C_Neck', Head: 'J_Bip_C_Head',
  LeftShoulder: 'J_Bip_L_Shoulder', LeftArm: 'J_Bip_L_UpperArm', LeftForeArm: 'J_Bip_L_LowerArm', LeftHand: 'J_Bip_L_Hand',
  RightShoulder: 'J_Bip_R_Shoulder', RightArm: 'J_Bip_R_UpperArm', RightForeArm: 'J_Bip_R_LowerArm', RightHand: 'J_Bip_R_Hand',
  LeftUpLeg: 'J_Bip_L_UpperLeg', LeftLeg: 'J_Bip_L_LowerLeg', LeftFoot: 'J_Bip_L_Foot', LeftToeBase: 'J_Bip_L_ToeBase',
  RightUpLeg: 'J_Bip_R_UpperLeg', RightLeg: 'J_Bip_R_LowerLeg', RightFoot: 'J_Bip_R_Foot', RightToeBase: 'J_Bip_R_ToeBase',
};

export class MixamoWalk {
  // herBones: {name: Bone} in traverse order (parents first). herRestWorld: world quaternion of each bone in the T-pose.
  // herHipsRest: hips local position in the T-pose. idle: local quaternion of each bone in the standing pose.
  constructor(herBones, herRestWorld, herHipsRest, idle) {
    this.her = herBones; this.rest = herRestWorld; this.hipsRest = herHipsRest; this.idle = idle;
    this.ready = false; this.pairs = []; this.mixRest = {}; this.time = 0;
    this._q = new THREE.Quaternion(); this._p = new THREE.Quaternion(); this._d = new THREE.Quaternion();
  }
  async load(url) {
    const fbx = await new FBXLoader().loadAsync(url);
    this.group = fbx; fbx.updateMatrixWorld(true);
    const mixBones = {}; fbx.traverse(o => { if (o.isBone) mixBones[o.name.replace('mixamorig:', 'mixamorig')] = o; });
    for (const [m, h] of Object.entries(MAP)) {
      const mb = mixBones['mixamorig' + m], hb = this.her[h];
      if (mb && hb && this.rest[h]) { this.pairs.push([mb, hb, h]); this.mixRest[m] = mb.getWorldQuaternion(new THREE.Quaternion()).invert(); }
    }
    // keep her skeleton's own order so parents are posed before children
    const order = Object.keys(this.her); this.pairs.sort((a, b) => order.indexOf(a[2]) - order.indexOf(b[2]));
    this.mixHips = mixBones.mixamorigHips; this.mixHipsRestY = this.mixHips.getWorldPosition(new THREE.Vector3()).y;
    this.clip = fbx.animations[0]; this.mixer = new THREE.AnimationMixer(fbx); this.action = this.mixer.clipAction(this.clip); this.action.play();
    this.ready = true; return this;
  }
  // Advance the clip while she walks, pose her mapped bones, then fade toward the standing pose by (1 - weight).
  // Call AFTER every bone has been reset to the standing pose, BEFORE any mouse-follow. Returns nothing; sets hips y.
  update(dt, weight, speed = 1) {
    if (!this.ready) return;
    if (weight > 0.001) { this.mixer.update(dt * speed); this.group.updateMatrixWorld(true); }
    for (const [mb, hb, h] of this.pairs) {
      const m = mb.name.replace('mixamorig', '');
      // world delta of the Mixamo bone since its T-pose
      mb.getWorldQuaternion(this._d).multiply(this.mixRest[m]);
      // her bone's target world = delta · her rest world; local = parent⁻¹ · target
      hb.parent.getWorldQuaternion(this._p).invert();
      hb.quaternion.copy(this._p).multiply(this._q.copy(this._d).multiply(this.rest[h]));
      if (weight < 0.999 && this.idle[h]) hb.quaternion.slerp(this.idle[h], 1 - weight);
    }
    // hips: keep her on the spot, take only the up-and-down of the walk (Mixamo is in cm; scale by rest heights)
    const hips = this.her.J_Bip_C_Hips;
    if (hips && this.hipsRest) {
      const bob = (this.mixHips.position.y - this.mixHipsRestY) * (this.hipsRest.y / this.mixHipsRestY);
      hips.position.set(this.hipsRest.x, this.hipsRest.y + bob * weight, this.hipsRest.z);
    }
  }
}
