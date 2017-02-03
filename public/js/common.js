
$(function()
	{
		// works for left bar sliding
		$("#streamButton").click(function()
		{ 
			$("#slideStreamInfo").animate({width: 'toggle'});
			$(this).find('span').toggleClass('glyphicon glyphicon-menu-right').toggleClass('glyphicon glyphicon-menu-left');
			
		});
		//works for logs dropdown
		$('#downGlyphicon').click(function() {
			$("#demo").slideToggle('slow','linear');
			$('#downGlyphicon').toggleClass('glyphicon glyphicon-chevron-down').toggleClass('glyphicon glyphicon-chevron-up');
			});
		//navigation bar
		var hamOpen = true;
		$('#hamburger').click(function(){
			$(this).toggleClass('open');
			if(hamOpen == true){
				document.getElementById("sidenav").style.width = "200px";
				document.getElementById("main").style.marginLeft = "200px";
				hamOpen = false;
			}
			else if(hamOpen == false){
				document.getElementById("sidenav").style.width = "0";
				document.getElementById("main").style.marginLeft= "0";
				hamOpen = true;
			}
		});
	});
function slideLog(){
	$("#demo").slideDown('slow','linear');
	$('#downGlyphicon').toggleClass('glyphicon glyphicon-chevron-down').toggleClass('glyphicon glyphicon-chevron-up');
}


//customize the date format
function getDate(){
	var today = new Date();
	var currDay = today.getDate();
	var currMonth = today.getMonth();
	var currYear = today.getFullYear();
	var currHours = today.getHours();
	var curMins = today.getMinutes();
	var curSec = today.getSeconds();
	var date = currDay + "/" + currMonth + "/" + currYear + " " + currHours + ":" + curMins + ":" + curSec ;
	date = date.fontcolor("#3F51B5");
	return date;
}
