<?PHP

ini_set('display_errors', 1);
require('PHPMailer/PHPMailerAutoload.php');
require('../config/param.php');

$post_data = file_get_contents("php://input");
$post_data = json_decode($post_data, TRUE);

//insert data into database if used
if (isset($dbtype, $dbhost, $dbport, $dbname, $dbuser, $dbpassword)){
	
	if ($dbtype == 'pgsql'){
		//test db credentials
		try {
			$dbh = new PDO("pgsql:host=$dbhost port=$dbport dbname=$dbname", $dbuser, $dbpassword);
			$dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
		} catch (PDOException $e) {
			echo 'Error: ' . $e->getMessage();
		}

		function makeParticipantTable($dbh, $pid){
			//create participant data table if it doesn't exist
			$sql = "CREATE TABLE IF NOT EXISTS p".$pid."_story (label text primary key, time integer, clicks integer);";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->execute();
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}

		function makeBigTable($dbh, $tname, $cols){
			$cols = implode(' integer, ', $cols);
			//create data table if it doesn't exist
			$sql = "CREATE TABLE IF NOT EXISTS $tname (pid integer primary key, $cols integer);";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->execute();
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}

		function addBigTableData($dbh, $pid, $tn, $cs, $ps, $vs){
			//add row for participant if needed
			$sql = "INSERT INTO $tn (pid) SELECT :pid WHERE NOT EXISTS ".
				"(SELECT pid FROM $tn WHERE pid = :pid);";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->bindParam(':pid', $pid);
				$stmt->execute();
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
			//turn arrays into strings
			$cs = implode(", ", $cs);
			$ps = implode(", ", $ps);
			$vs["pid"] = $pid;
			//add data to data table
			$sql = "UPDATE $tn SET ($cs) = ($ps) WHERE pid = :pid;";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->execute($vs);
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}

		function makeTables($dbh, $data){
			$pages = $data["pages"];
			$cols = array();
			foreach($pages as $p => $page){
				$pageCols = array();
				if (isset($page["story"])){
					$sets = $page["sets"];
					foreach($sets as $s => $set){
						$blocks = $set["blocks"];
						foreach($blocks as $b => $block){
							$blockLabel = isset($block["label"]) ? $block["label"] : 'p'.(string)($p+1).'s'.(string)($s+1).'b'.(string)($b+1);
							$pageCols[] = $blockLabel.'_time';
							$cols[] = $blockLabel.'_time';
							$pageCols[] = $blockLabel.'_clicks';
							$cols[] = $blockLabel.'_clicks';
						}
						$mapLabel = 'p'.(string)($p+1).(string)('map');
						$pageCols[] = $mapLabel.'_time';
						$cols[] = $mapLabel.'_time';
						$pageCols[] = $mapLabel.'_clicks';
						$cols[] = $mapLabel.'_clicks';
					}
				}
				if (!empty($pageCols)){
					makeBigTable($dbh, 'story_page_'.(string)($p+1), $pageCols);
				}
			}
			if (!empty($cols)){
				makeBigTable($dbh, 'story_master', $cols);
			}
		}

		function updateTables($dbh, $data){
			$pid = $data["pid"]["value"];
			makeParticipantTable($dbh, $pid);

			$page = -1;
			$pages = array();
			$pageArray = array();

			foreach($data as $key => $block){
				$name = $block["name"];
				if ($name != 'pid' && $name != 'updatetime' && $name != 's'){
					
					if ($block["page"] > $page){
						$page = $block["page"];
						$pageArray = array();
					}

					$time = $block["time"];
					$clicks = $block["clicks"];

					$columns[] = $name."_time";
					$columns[] = $name."_clicks";
					$pageArray["columns"][] = $name."_time";
					$pageArray["columns"][] = $name."_clicks";
					$placeholders[] = ":".$name."_time";
					$placeholders[] = ":".$name."_clicks";
					$pageArray["placeholders"][] = ":".$name."_time";
					$pageArray["placeholders"][] = ":".$name."_clicks";
					$values[$name."_time"] = $time;
					$values[$name."_clicks"] = $clicks;
					$pageArray["values"][$name."_time"] = $time;
					$pageArray["values"][$name."_clicks"] = $clicks;
					$pages[$page] = $pageArray;

					$sql = "INSERT INTO p".$pid."_story SELECT :label WHERE NOT EXISTS ".
						"(SELECT label FROM p".$pid."_story WHERE label = :label);";
					try {
						$stmt = $dbh->prepare($sql);
						$stmt->bindParam(':label', $name);
						$stmt->execute();
					} catch (PDOException $e) {
						echo 'SQL Query: ', $sql;
						echo 'Error: ' . $e->getMessage();
					}

					//insert data into participant data table
					$sql = "UPDATE p".$pid."_story SET (label, time, clicks) = (:label, :time, :clicks) WHERE label = :label;";
					try {
						$stmt = $dbh->prepare($sql);
						$stmt->bindParam(':label', $name);
						$stmt->bindParam(':time', $time);
						$stmt->bindParam(':clicks', $clicks);
						$stmt->execute();
					} catch (PDOException $e) {
						echo 'SQL Query: ', $sql;
						echo 'Error: ' . $e->getMessage();
					}
				}
			}

			//insert data into master data table
			addBigTableData($dbh, $pid, 'story_master', $columns, $placeholders, $values);

			//insert data into page tables
			foreach($pages as $p => $page){
				addBigTableData($dbh, $pid, 'story_page_'.$p, $page["columns"], $page["placeholders"], $page["values"]);
			}
		}

		if (isset($post_data["pages"])){
			makeTables($dbh, $post_data);
		} else {
			updateTables($dbh, $post_data);
		}
	}
}

//e-mail data if e-mail is set up
if (isset($smtphost, $smtpport, $euser, $epass, $toaddr, $subject, $message) && $post_data["action"] == "submit"){
	//WRITE FILE
	//variables of great social and political import
	$pid = $post_data["pid"]["value"];
	//column headers
	$csv = "label, time, clicks\n";
	//add rows
	foreach($post_data as $key => $block){
		if ($key != "action" && $key != "pid" && $key != "updatetime"){
			$csv = $csv . 
				$block["name"] . ", " .
				$block["time"] . ", " .
				$block["clicks"] . "\n";
		}
	}
	//check for participants directory and create if not exists
	if (!file_exists("../participants")){
		mkdir("../participants", 0777, true);
	}
	//write it!
	$filepath = "../participants/p".$pid."_story.csv";
	$file = fopen($filepath, "w") or die("Can't open file!");
	fwrite($file, $csv);
	fclose($file);

	//SEND E-MAIL
	//path to participant interactions file
	$ipath = "../participants/p".$pid."_interactions.csv";
	//name of MapStudy app directory
	$appdir = ucfirst(array_pop(explode('\\', dirname(getcwd()))));
	echo $appdir;
	//use PHPMailer class to build e-mail
	$mail = new PHPMailer;
	$mail->SMTPDebug = 3;
	$mail->isSMTP();
	$mail->Host = $smtphost;
	$mail->SMTPAuth = true;
	$mail->Username = $euser;
	$mail->Password = $epass;
	$mail->SMTPSecure = 'tls';
	$mail->Port = $smtpport;
	$mail->setFrom($euser, $appdir . ' MapStudy Application');
	$mail->addAddress($toaddr);
	$mail->addAttachment($filepath);
	if (file_exists($ipath)){
		$mail->addAttachment($ipath);
	}
	$mail->isHTML(true);
	$mail->Subject = $subject;
	$mail->Body = $message;
	//send e-mail
	if(!$mail->send()){
		echo 'Mailer error: ' . $mail->ErrorInfo;
	}
}

?>