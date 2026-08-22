export type QuestState='NOT_STARTED'|'INTRODUCED'|'ACCEPTED'|'PARTY_MET'|'PREPARED'|'ENTERED_CRYPT'|'CRYPT_ATTEMPTED'|'CRYPT_CLEARED'|'RETURNED_TO_GUILD'|'COMPLETE';
export interface DialogueLine{speaker:string;text:string}
export const QUEST_TITLE='Embers Beneath the Crypt';
export const STORY={
 stewardIntro:[
  {speaker:'Steward Elira',text:'Three gravekeepers failed to return before dawn.'},
  {speaker:'Steward Elira',text:'They were working beneath the eastern cemetery. Something in the Ashen Crypt is awake again.'},
  {speaker:'Steward Elira',text:'Aldric and his company will go with you. Find them in the square, then prepare at the forge.'},
 ],
 party:[
  {speaker:'Aldric',text:'Shield first. Questions after everyone comes home.'},
  {speaker:'Mira',text:'The dead are restless, but fear spreads faster. We should move carefully.'},
  {speaker:'Nyx',text:'Tracks lead into the crypt. None lead out. I checked twice.'},
  {speaker:'Orin',text:'The heat below is wrong for a tomb. I would very much like to know why.'},
 ],
 blacksmith:[{speaker:'Blacksmith Torren',text:'Crypt stone ruins an edge. I have checked the party gear. Keep your guard high and your lantern higher.'}],
 board:[{speaker:'Notice Board',text:'EASTERN CEMETERY — Grave-work suspended. Missing workers. Guild investigation authorized.'}],
 locked:[{speaker:'Aldric',text:'We are not walking into that crypt without the Steward’s writ.'}],
 return:[
  {speaker:'Steward Elira',text:'You returned. The gravekeepers did not. That is answer enough for tonight.'},
  {speaker:'Orin',text:'The Ghoul was only feeding near the surface. Something deeper is warming the sealed stone.'},
  {speaker:'Steward Elira',text:'Rest while you can. Whatever woke beneath the crypt has not finished waking.'},
 ],
} satisfies Record<string,DialogueLine[]>;
export function objectiveFor(s:QuestState):string{
 if(s==='NOT_STARTED')return 'Speak with the Guild Steward';
 if(s==='INTRODUCED'||s==='ACCEPTED')return "Meet Aldric's party";
 if(s==='PARTY_MET')return 'Speak with the Blacksmith';
 if(s==='PREPARED')return 'Enter the Ashen Crypt';
 if(s==='ENTERED_CRYPT'||s==='CRYPT_ATTEMPTED')return 'Complete Ashen Crypt Zone 1';
 if(s==='CRYPT_CLEARED')return 'Return to the Guild Steward';
 if(s==='RETURNED_TO_GUILD')return 'Report what lies beneath the crypt';
 return 'Quest complete';
}
