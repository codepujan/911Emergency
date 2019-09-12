var express=require('express');
var app=express();

const bodyParser = require('body-parser');


var cors = require('cors')

app.use(cors())

app.use(bodyParser.urlencoded({ extended: false }));

const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;
const initialGreeting="Hello Nine One One here. What's your emergency?"

const initialSpeechtimeout=6;

const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://hackathon:hakarpujan@cluster0-lxfzm.mongodb.net/test?retryWrites=true&w=majority";
const db_client = new MongoClient(uri, { useNewUrlParser: true });


const dialogflow = require('dialogflow');
const uuid = require('uuid');

let sugar=require('sugar')

let fuzz = require('fuzzball');

let combinedcases={}

let fsm_organized={
  "general":{
    "location":"",
    "type":"",
    "casualtycount":-1,
    "duration_ago":"",
    "phone":"",
},
  "extra_shootout":{
    "gunused":"",  
    "suspect_age":"",
    "suspect_race":"",
    "suspect_heading":"",
  },
  "extra_disaster":{
    
  },
  "fsm_meta":{
    "updates_since_last":0
  }
}

let fsm_raw={
   "Address":"",
    "DisasterType":"",
    "injured-count":-1,
    "time":"",
    "phone-number":"",
    "gunused":"",  
    "suspect_age":"",
    "suspect_race":"",
    "suspect_heading":"",
   "updates_since_last":0,
  "location_confirmation":0,
  "lastprompt_loc_confirm":0,
  "City":"",
  "safe_nearby":-1,
  "lastprompt_safe_nearby":0,
  "details_inquired":0,
  "DisasterDetermined":0,
  "time_inquired":0,
  "injurycount_inquired":0,
  "finalinquiry":0,
  "time_confirmed":0
}



app.get('/get_dashboard',function(req,res){
  
   const collection = db_client.db("911overflow").collection("combined_cases");
   // const indiCollection=db_client.db("911overflow").collection("individual_call_record");
    collection.find({}).toArray(function(err, result) {
    if (err) throw err;
     
      res.send({"result":result})
      
    })
  
})


app.get('/get_individualcase',function(req,res){
  
  console.log("Inside Get Individual Case ")
  console.log(req.query.cid)
  const indiCollection=db_client.db("911overflow").collection("individual_call_record");
  indiCollection.find({parentcaseId:req.query.cid}).toArray(function(err, result) {
    if (err) throw err;
     
      res.send({"result":result})
      
    })

})





app.post('/call',function(req,res)
{
 console.log("Got a call or something");
 const twiml = new twilio.twiml.VoiceResponse();
  twiml.gather({
    input: 'speech',
    timeout: initialSpeechtimeout,
    action: '/useresponse'
  }).say(initialGreeting);
  
res.send(twiml.toString());
  
});

app.post('/useresponse',function(req,res)
{
    console.log("Got some user response at least !! ")
  
  console.log(req.body.SpeechResult)

 
  pipeline(req,res)
  
  
});





async function pipeline(req,res){
  
   await runSample(req.body.SpeechResult);
  
  console.log("Interogating for recent user response",req.body.SpeechResult)
  
  interrogateString=getNewResponseString(req.body.SpeechResult);
  
  
  if(fsm_raw.finalinquiry!=-1) //end of terminal sccript 
    {
      
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.gather({
    input: 'speech',
    timeout: initialSpeechtimeout,
    action: '/useresponse'
  }).say(interrogateString);
  
  
  console.log("Asking user the question....")
  console.log(interrogateString)
  
res.send(twiml.toString());
  
    }
  else if(fsm_raw.finalinquiry==-1)
  {
    
    fuzzyMatchingTest(res,interrogateString)

 
  }  
}

function getNewResponseString(rawResponse)
{
//First things first , get the location 
  
  //Re-affirm location 
  
  if(fsm_raw.DisasterType!="")
      fsm_raw.DisasterDetermined=1 //if not empty , disaster determined 
  
  if(fsm_raw.lastprompt_loc_confirm==1){
    yes_no=rawResponse.toLowerCase()
    console.log("LocConfirm Yes_No affirmation was ",yes_no)
    if (yes_no.includes("yes") || yes_no.includes("yeah") || yes_no.includes("correct") || yes_no.includes("right")){
      fsm_raw.lastprompt_loc_confirm=0
      fsm_raw.location_confirmation=1
    }else{
      //TODO : Reset the process for location reset and asking again . 
      fsm_raw.lastprompt_loc_confirm=0
      fsm_raw.location_confirmation=1

    }
  }
  
  let askString=""; 
  
  let combinedLocation=fsm_raw.Address+fsm_raw.City
  
  console.log("Combined Location is ",combinedLocation)
  
  if (combinedLocation=="")
    {
      //Get the location 
      askString+="Can you please tell us your where you are calling from ?"
      lastprompt_loc_confirm=0
      //return askString
    }
  if (combinedLocation!="" && fsm_raw.location_confirmation==0){
    askString+="Let me confirm your location . "+combinedLocation+"  "+"Is it correct ?"
    fsm_raw.lastprompt_loc_confirm=1
    //return askString
  }
  if(fsm_raw.location_confirmation==1&&fsm_raw.DisasterType==""){
    askString+="We are sending help right away. What is your emergency ? "
    //return askString
  }
  
  
  if(fsm_raw.location_confirmation==1 && fsm_raw.DisasterType!="")
  {
    
    if (fsm_raw.safe_nearby==-1 && fsm_raw.lastprompt_safe_nearby==0){
      
      askString+=" Are you able to find some safe place nearby ?"
      fsm_raw.lastprompt_safe_nearby=1;
      //return askString
    }
    else if(fsm_raw.lastprompt_safe_nearby==1)
    {
      //get the answer of safe or not 
      
      yes_no=rawResponse.toLowerCase()
    console.log("SafeLoc Yes_No affirmation was ",yes_no)
    if (yes_no.includes("yes") || yes_no.includes("yeah") || yes_no.includes("correct") || yes_no.includes("right")){
      fsm_raw.safe_nearby=1
    }
      else{
              fsm_raw.safe_nearby=0
      }
      fsm_raw.lastprompt_safe_nearby=0 // not searching for safe nearby no more 
      
      
      if(fsm_raw.safe_nearby==0){
        askString+=" Look around to find safe places for cover. Our team will be right at your place for help. Please don't panick. "
      }else if(fsm_raw.safe_nearby==1)
      {
        askString+=" Keep yourself safe wherever you are right now. Please don't panick. Our team will be right at your place for help "
      }
      
      askString+=" Can you give me your phone number , Please ? "
      //return askString
      
    }
  }
  
  //Location confirmation and phone number got , now into the details 
  
  
    if(fsm_raw.time_confirmed!=1 && fsm_raw['phone-number']!="" && fsm_raw.DisasterDetermined==1 && fsm_raw.location_confirmation==1 && fsm_raw.time_inquired==0 &&fsm_raw.safe_nearby!=-1){
        askString+=" All right. Tell me when did it happen ? "
        fsm_raw.time_inquired=1
    }
    
    else if (fsm_raw.time_inquired==1)
    {
     
      console.log("FSM is ",fsm_raw)
      raw_time=fsm_raw.time
      console.log("Raw time",raw_time)
      caller_time=sugar.Date.create(raw_time)
      console.log("Caller time",caller_time)
      fsm_raw.time_inquired=0
      
      
      fsm_raw.time_confirmed=1
      
      console.log("Should go into next step if shooting")
      console.log(fsm_raw.DisasterType)
      console.log(fsm_raw['injured-count'])
      console.log(fsm_raw.injurycount_inquired)
      
      if(fsm_raw.DisasterType=="shooting" && fsm_raw['injured-count']==-1 && fsm_raw.injurycount_inquired==0)
      {
        askString+=" Could you tell me how many people were injured ? "
        fsm_raw.injurycount_inquired=1
        fsm_raw.finalinquiry=0
      }
      else if(fsm_raw.DisasterType!="shooting")
      {
        console.log("End of non Shooting scenario, should go to ending greeting after this ....")
           askString+= " Our first responders are right away at your area. Please stay calm."
    fsm_raw.finalinquiry=-1
      
      
      }

    }
    else if(fsm_raw.injurycount_inquired==1)
      {
        fsm_raw.injurycount_inquired=0
        
        //For now , let's do a final inquiry sort of thing 
        //askString+=" Thank you for cooperation. Could you tell me how old was the person ? What kind of gun was he carrying ?"
        askString+=" Thank you for cooperation."
        fsm_raw.finalinquiry=-1
      }
    else if(fsm_raw.finalinquiry==1){
      fsm_raw.finalinquiry=-1
      askString+= "Thank you for the information you have provided along. Please stay calm and collected in safety point."
    }
  
  
  //Hunting for extra details from the link 
  
  
  return askString
  
}

async function runSample(transcript,projectId = 'i911emergency-cxvdvl') {
  
  // A unique identifier for the given session
  const sessionId = uuid.v4(); //TODO : UUID based on context , call wise , if we ever use the long run cntext or FSM wala thing 


  
  // Create a new session
  const sessionClient = new dialogflow.SessionsClient();
  const sessionPath = sessionClient.sessionPath(projectId, sessionId);

    console.log("Sending Async Request for DialogFlow ",transcript)

  
  // The text query request.
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        // The query to send to the dialogflow agent
        text: transcript,
        // The language used by the client (en-US)
        languageCode: 'en-US',
      },
    },
  };
  
    const responses = await sessionClient.detectIntent(request);
  console.log('Detected intent');
  const result = responses[0].queryResult;
  
  console.log(`  Query: ${result.queryText}`);
  console.log(`  Response: ${result.fulfillmentText}`);
  
  if (result.intent) {
    console.log(`  Intent: ${result.intent.displayName}`);
      updateFSM(result.parameters)

  } else {
    console.log(`  No intent matched.`);
    console.log(" Give some clear information type response")
  }
  
  
  
}
  


function updateFSM(paramObject){

   console.log("DialogFlow Res",paramObject.fields)
  //  console.log(result.parameters.fields.DisasterType.stringValue);
  for (let param in paramObject.fields){
    //fsm_raw[param.]
    if(paramObject.fields[param].stringValue!="" && paramObject.fields[param].stringValue!=null)
      {
        fsm_raw[param]=paramObject.fields[param].stringValue
      }
  }
  
  console.log("FSM Object after calling Intent",fsm_raw)
}



function fuzzyMatchingTest(res,interrogateString){
  
  console.log("Inside Fuzzy Matching Test")
  
    const collection = db_client.db("911overflow").collection("combined_cases");
    const indiCollection=db_client.db("911overflow").collection("individual_call_record");
  
   
      test_address=fsm_raw.Address+fsm_raw.City
      test_time=new sugar.Date.create(fsm_raw.time)
      ////////
      test_type=fsm_raw.DisasterType
  
    collection.find({}).toArray(function(err, result) {
    if (err) throw err;
      combinedcases=result;
      
      console.log("All existing cases are",combinedcases)
     
      ////
            console.log(test_time)
          console.log(test_address)
      console.log(test_type)
      
      matchFlag=0
      for(let casex in combinedcases)
      {
        cid=combinedcases[casex]._id
        let main=new Date(combinedcases[casex].event_time)

       adress_fuzz=fuzz.partial_ratio(combinedcases[casex].location,test_address) 
       type_fuzz=fuzz.partial_ratio(combinedcases[casex].disaster_type,test_type)
       duration=Math.abs(main.getHours()-test_time.getHours())
       
        
        console.log("Fuzz matches",adress_fuzz,type_fuzz,duration)
        
        if(adress_fuzz>75 && type_fuzz>0.9 && duration<2)
        {
          //Similar , add Report count 
          console.log("Matchhh")
          matchFlag=1
          //Number of incidences 
          collection.updateOne({_id:cid.toString()},{"$inc":{num_reports:1}});
          //Individual Reports 
    
        
          let indiObject={
           parentcaseId:cid.toString(),
            address:test_address,
            injured_count:fsm_raw['injured-count'],
            DisasterType:test_type,
            phone_number:fsm_raw['phone-number']
          }
          indiCollection.insert(indiObject, {w: 1}, function(err, records)
                                {
          console.log("Record added")
            
            console.log("Sending DEparting Text")
            //Send the response
             const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(interrogateString);
  // Render the response as XML in reply to the webhook request
  res.send(twiml.toString());
            
          });
          
          
        }
       
      }
      
      if(matchFlag==0)
        {          
          console.log("Brand New BallGame babyyy")
                 let indiObject={
            num_reports:1,
            location:fsm_raw.Address+fsm_raw.City,
            disaster_type:test_type,
            event_time:test_time
          }
                 
          collection.insertOne(indiObject, {w: 1}, function(err, records)
                                {
          console.log("Record added")
            
            console.log("Sending DEparting Text")
            //Send the response
             const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(interrogateString);
  // Render the response as XML in reply to the webhook request
  res.send(twiml.toString());
            
          });
          
          
        }
      
  });
}

var server=app.listen(3000,function() {
  
  console.log("Server Started")
  
  

db_client.connect(err => {
  

  if(err==null)
    console.log("DB Connection error")
  console.log("Database Connection Succesful")
  // perform actions on the collection object
 // db_client.close();
  
  
  
  //TEst 
  // Send request and log result
  
  //runSample();
  
  //fuzzyMatchingTest();
  
  
});

});
