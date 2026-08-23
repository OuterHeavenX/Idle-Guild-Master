export type QuestState='NOT_STARTED'|'INTRODUCED'|'ACCEPTED'|'PARTY_MET'|'PREPARED'|'ENTERED_CRYPT'|'CRYPT_ATTEMPTED'|'CRYPT_CLEARED'|'RETURNED_TO_GUILD'|'COMPLETE';
export interface DialogueLine{speaker:string;text:string}
export const QUEST_TITLE='Embers Beneath the Crypt';
export const STORY={
 stewardIntro:[
  {speaker:'Steward Elira',text:'Three grave-workers failed to return before dawn. This outpost can spare neither hands nor rumors.'},
  {speaker:'Steward Elira',text:'They vanished beneath the eastern cemetery. Aldric’s company found fresh tracks at the Ashen Crypt—and heat where no heat should be.'},
  {speaker:'Steward Elira',text:'Take your company, have Torren check your gear, then learn what woke below us.'},
 ],
 party:[
  {speaker:'Mira',text:'You heard Elira. The dead are restless, but fear will outrun them if we let it.'},
  {speaker:'Nyx',text:'Tracks go in. None come out. I checked twice, since Orin asked whether ghosts leave footprints.'},
  {speaker:'Orin',text:'They do not. Usually. The warmth beneath the stones interests me considerably more.'},
  {speaker:'Aldric',text:'Then we stay together. Shield first. Questions after everyone comes home.'},
 ],
 blacksmith:[
  {speaker:'Blacksmith Torren',text:'Crypt stone ruins an edge and panic ruins the hand holding it.'},
  {speaker:'Blacksmith Torren',text:'Your gear will hold. Keep your guard high and your lantern higher.'},
 ],
 board:[
  {speaker:'Notice Board',text:'EASTERN CEMETERY — Grave-work suspended. Three workers missing. Guild investigation authorized.'},
  {speaker:'Notice Board',text:'Below it, a newer scrap reads: Contracts delayed until the crypt road is safe.'},
 ],
 boardAfterClear:[
  {speaker:'Notice Board',text:'ASHEN CRYPT — Upper chamber secured by Aldric of the Guild. Cemetery work remains suspended.'},
  {speaker:'Notice Board',text:'A fresh note in Elira’s hand reads: The lower seal is not to be disturbed.'},
 ],
 locked:[{speaker:'Aldric',text:'Elira barred expeditions until we report to the Guild Hall. We do this properly.'}],
 afterClearParty:[
  {speaker:'Mira',text:'That heat was not from the Ghoul. Something below it felt awake.'},
  {speaker:'Nyx',text:'And the sealed stairs were scratched from the other side. I dislike useful details like that.'},
  {speaker:'Orin',text:'The upper crypt is a lid. Whatever is warming the old stone is deeper.'},
 ],
 return:[
  {speaker:'Steward Elira',text:'So the Ghoul activity was real. And the grave-workers were caught in something larger than a feeding nest.'},
  {speaker:'Orin',text:'The sealed architecture below the upper crypt is warming. Old magic, perhaps older than the cemetery built over it.'},
  {speaker:'Steward Elira',text:'Then the upper crypt was only the beginning. Rest while you can. I want that lower seal understood before it opens itself.'},
 ],
 complete:[{speaker:'Steward Elira',text:'The guild has your report. When we go below again, we go knowing the tomb was built over something older.'}],
 smithAfterClear:[{speaker:'Blacksmith Torren',text:'Shield’s scarred, edge is honest, and you walked back under your own power. I call that serviceable work.'}],
} satisfies Record<string,DialogueLine[]>;
export function objectiveFor(s:QuestState):string{
 if(s==='NOT_STARTED')return 'Speak with the Guild Steward';
 if(s==='INTRODUCED'||s==='ACCEPTED')return "Meet Aldric's party";
 if(s==='PARTY_MET')return 'Speak with the Blacksmith';
 if(s==='PREPARED')return 'Enter the Ashen Crypt';
 if(s==='ENTERED_CRYPT'||s==='CRYPT_ATTEMPTED')return 'Clear the upper Ashen Crypt';
 if(s==='CRYPT_CLEARED'||s==='RETURNED_TO_GUILD')return 'Return to the Guild Steward';
 return 'Quest complete · A deeper seal is stirring';
}
