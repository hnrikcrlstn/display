$(document).ready(function() {
    $.support.cors = true;
    console.log('Script started');
})

$('#testBtn').on('click' , function() {
    
    console.log('Button clicked');
    
    var apiUrl = 'https://api.trafikinfo.trafikverket.se/v2/data.json';
    var apiKey = '50aff4a70a3749b1b0921745f8d2086d';
    let xmlRequest = "<REQUEST>" +
                        "<LOGIN authenticationkey='"+ apiKey + "'/>" +
                        "<QUERY objecttype='TrainAnnouncement' schemaversion='1.8' orderby='AdvertisedTimeAtLocation' limit='15'>" +
                            "<FILTER>" +
                                "<AND>" +
                                    "<EQ name='ActivityType' value='Avgang' />" +
                                    "<EQ name='InformationOwner' value='SL' />" +
                                    "<EQ name='LocationSignature' value='Upv' />" +
                                    "<EQ name='Advertised' value='true' />" +
                                        "<AND>" +
                                                "<GT name='AdvertisedTimeAtLocation' value='$dateadd(-00:30:00)' />" +
                                                "<LT name='AdvertisedTimeAtLocation' value='$dateadd(02:00:00)' />" +
                                        "</AND>" +
                                "</AND>" +
                            "</FILTER>" +
                            "<INCLUDE>ProductInformation</INCLUDE>" +
                            "<INCLUDE>ScheduledDepartureDateTime</INCLUDE>" +
                            "<INCLUDE>EstimatedTimeAtLocation</INCLUDE>" +
                            "<INCLUDE>TimeAtLocation</INCLUDE>" +
                            "<INCLUDE>AdvertisedTimeAtLocation</INCLUDE>" +
                            "<INCLUDE>ToLocation</INCLUDE>" +
                            "<INCLUDE>LocationSignature</INCLUDE>" +
                            "<INCLUDE>TrackAtLocation</INCLUDE>" +
                            "<INCLUDE>PlannedEstimatedTimeAtLocation</INCLUDE>" +
                            "<INCLUDE>OtherInformation</INCLUDE>" +
                            "<INCLUDE>Canceled</INCLUDE>" +
                            "<INCLUDE>Deviation</INCLUDE>" +
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
  console.log('POST Done');

}).trigger('click');

function getStationNames(id) {
    /* TODO: Use function to return station names from the errorArray in displayTrainInfo() */
    console.log(data);
}

function displayTrainInfo(data) {
    console.log('Function started');
    /* OtherInformations to ignore by error handler */
    const unimportantMessages = [
        'Resa förbi Arlanda C kräver både UL- och SL- biljett.', 
        'Anslutning till linje 48 mot Gnesta i Södertälje hamn.',
        'Stannar ej vid Trångsund, Skogås, Vega, Jordbro.',
        'Stannar ej vid Arlanda C.',
        'Stannar även vid Rosersberg.', 
        'Resa förbi Märsta kräver både UL- och SL- biljett.', 
        'Tåget går endast till Södertälje hamn.',
        'Anslutning till linje 48 mot Gnesta i Södertälje hamn.'];

    /* Array with station id for northen stations, to deduce travel orientation */
    const northenStations = ['U', 'Mr', 'Arnc', 'Kn', 'Rs'];
    /* Check if train is heading north */
    
    console.log(data);
   /*   Gather the next 15 departures
        Display the upcoming 4 departures
        Check for upcoming cancellations */
    
    /* If there is a cancelled departure, store the index in a new array for future handling */
    let errorArray = [];
    
    /* Save number of north and south heading departures */
    let north = 0;
    let south = 0;

    /* Main loop of function, handle the stored train data one at a time */
    for (let i = 0; i < data.length; i++) {
        /* Checks for cancellations and delays, save train index for future handling */
        /* TODO: Deviation innehåller inställt */
        if (data[i].OtherInformation != null) {
            if (data[i].OtherInformation.length == 1 && !unimportantMessages.includes(data[i].OtherInformation[0].Description)) {
                console.log('Error level 1, ' + data[i].OtherInformation[0]);
                errorArray.push(i);
            } else if (data[i].OtherInformation.length > 1) {
                for (let n = 0; n < data[i].OtherInformation.length; n++) {
                    if (!unimportantMessages.includes(data[i].OtherInformation[n].Description)) {
                        console.log('Error level 2, ' + data[i].OtherInformation[n].Description);
                        errorArray.push(i);
                        n = data[i].OtherInformation.length + 1;
                    }
                }
            }
        }  

        let direction = northenStations.includes(data[i].ToLocation[0].LocationName);

        if ((direction && north < 2) || (!direction && south < 2)) {
            let trainTime = new Date(data[i].AdvertisedTimeAtLocation);
            let trainTimeEst;
            /* Check for new est. time */
            if (data[i].EstimatedTimeAtLocation) {
                trainTimeEst = new Date(data[i].EstimatedTimeAtLocation);
            }
            
            /* Calculate container classes */
            let trainContain;
            if (direction > 0) {
                trainContain = '.train-n-' + north;
            } else {
                trainContain = '.train-s-' + south;
            }

            /* Determine if data post is relevant to display */
            let relevant = false;
            if (trainTime - Date.now() > 0) {
                relevant = true;
            }
            if (data[i].EstimatedTimeAtLocation && trainTimeEst - Date.now() > 0) {
                relevant = true;
            }

            if (relevant) {
                if (data.Canceled) {
                    $(trainContain).addClass('canceled');
                }
                $(trainContain + ' .trainNo').text(data[i].ProductInformation[1].Description);
                $(trainContain + ' .trainRail').text(data[i].TrackAtLocation);
                $(trainContain + ' .trainDep').text(addZero(trainTime.getHours()) + ':' + addZero(trainTime.getMinutes()));
                $(trainContain + ' .trainTime').text((trainTimeEst > 0) ? Math.ceil((trainTimeEst - Date.now()) / 1000 / 60) + ' min':  Math.ceil((trainTime - Date.now()) / 1000 / 60) + ' min');

                /* If time as been changed, notify */
                if (trainTimeEst &&  (Math.round(trainTimeEst - trainTime) / 500 / 60) > 1) {
                    $(trainContain + ' .trainDep').addClass('delay');
                    $(trainContain + ' .trainDepNew').text(addZero(trainTimeEst.getHours()) + ':' + addZero(trainTimeEst.getMinutes())).show();
                }
                /* TODO: Deviation innehåller bla kort tåg */

                /* Keep track of how many north- and southbound trains has been presented */
                if (direction) {
                    north++;
                } else {
                    south++;
                }
            }
        }
    }
console.log('Script finished');
console.log('Errors: ' + errorArray.length);
}

function displayError(location, message) {
    alert('Error at: ' + location + ", " + message);
}

function addZero(i) {
    if (i < 10) {
        i = '0' + i;
    }
    return i;
}