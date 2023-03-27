$(document).ready(function() {
    $.support.cors = true;
    console.log('Script started');
})

$('#testBtn').on('click' , function() {
    
    console.log('Button clicked');
    
    let apiUrl = 'https://api.trafikinfo.trafikverket.se/v2/data.json';
    let apiKey = '50aff4a70a3749b1b0921745f8d2086d';
    let xmlRequest = "<REQUEST>" +
                        "<LOGIN authenticationkey='"+ apiKey + "'/>" +
                        "<QUERY objecttype='TrainAnnouncement' schemaversion='1.3' orderby='AdvertisedTimeAtLocation' limit='15'>" +
                            "<FILTER>" +
                                "<AND>" +
                                    "<EQ name='ActivityType' value='Avgang' />" +
                                    "<EQ name='InformationOwner' value='SL' />" +
                                    "<EQ name='LocationSignature' value='Upv' />" +
                                        "<OR>" +
                                            "<AND>" +
                                                    "<GT name='AdvertisedTimeAtLocation' value='$dateadd(-00:15:00)' />" +
                                                    "<LT name='AdvertisedTimeAtLocation' value='$dateadd(14:00:00)' />" +
                                            "</AND>" +
                                            "<AND>" +
                                                    "<LT name='AdvertisedTimeAtLocation' value='$dateadd(00:30:00)' />" +
                                                    "<GT name='EstimatedTimeAtLocation' value='$dateadd(-00:15:00)' />" +
                                            "</AND>" +
                                        "</OR>" +
                                "</AND>" +
                            "</FILTER>" +
                            "<INCLUDE>ProductInformation</INCLUDE>" +
                            "<INCLUDE>ScheduledDepartureDateTime</INCLUDE>" +
                            "<INCLUDE>AdvertisedTimeAtLocation</INCLUDE>" +
                            "<INCLUDE>ToLocation</INCLUDE>" +
                            "<INCLUDE>TrackAtLocation</INCLUDE>" +
                            "<INCLUDE>PlannedEstimatedTimeAtLocation</INCLUDE>" +
                            "<INCLUDE>OtherInformation</INCLUDE>" +
                        "</QUERY>" +
                        
                    "</REQUEST>";

    $.ajax({
        type: "POST",
        url: apiUrl,
        contentType: "text/xml",
        dataType: "json",
        data: xmlRequest,
        success: function (response) {
            if (response == null) return;
            displayTrainInfo($(response.RESPONSE.RESULT[0].TrainAnnouncement));
        }
    })
  console.log('Done');

}).trigger('click');

function displayTrainInfo(data) {
    /* OtherInformations to ignore by error handler */
    const unimportantMessages = [
        'Resa förbi Arlanda C kräver både UL- och SL- biljett.', 
        'Anslutning till linje 48 mot Gnesta i Södertälje hamn.', 
        'Stannar ej vid Arlanda C.',
        'Stannar även vid Rosersberg.', 
        'Resa förbi Märsta kräver både UL- och SL- biljett.', 
        'Anslutning till linje 48 mot Gnesta i Södertälje hamn', 
        'Anslutning till linje 48 mot Gnesta i Södertälje hamn.'];

    console.log(data);
   /*   Gather the next 10 departures
        Display the upcoming 4 departures
        Check for upcoming cancellations */
    
    /* If there is a cancelled departure, store the index in a new array for future handling */
    let errorArray = [];
    let accepted = 0;

    for (let i = 0; i < data.length; i++) {
        if (data[i].OtherInformation != null) {
            if (data[i].OtherInformation.length == 1 && !unimportantMessages.includes(data[i].OtherInformation[0])) {
                console.log('Error level 1, ' + data[i].OtherInformation[0]);
                errorArray.push(i);
            } else if (data[i].OtherInformation.length > 1) {
                for (let n = 0; n < data[i].OtherInformation.length; n++) {
                    if (!unimportantMessages.includes(data[i].OtherInformation[n])) {
                        console.log('Error level 2, ' + data[i].OtherInformation[n]);
                        errorArray.push(i);
                        n = data[i].OtherInformation.length + 1;
                    }
                }
            }
        }  

        /* Print the 4 first results, check the rest for traffic info */
        if (accepted < 4) {
            /* Check if data is old, if so discard and move on in loop */
            let trainTime = new Date(data[i].AdvertisedTimeAtLocation);
                if (trainTime - Date.now() > 0) {
                    $('.train-' + accepted + ' .trainNo').text(data[i].ProductInformation[1]);
                    $('.train-' + accepted + ' .trainRail').text(data[i].TrackAtLocation);
                    if (trainTime.getMinutes() < 10) {
                        $('.train-' + accepted + ' .trainDep').text(trainTime.getHours() + ':0' + trainTime.getMinutes());
                    } else {
                        $('.train-' + accepted + ' .trainDep').text(trainTime.getHours() + ':' + trainTime.getMinutes());
                    }
                    
                    $('.train-' + accepted + ' .trainTime').text(Math.round((trainTime - Date.now()) / 1000 / 60));

                    accepted++;
                }
            
        }
   
    }
}

function displayError(location, message) {
    alert('Error at: ' + location + ", " + message);
}