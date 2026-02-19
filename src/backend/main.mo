import Map "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";
import Float "mo:core/Float";
import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Order "mo:core/Order";



actor {
  type Horse = {
    odds : Float;
    predictedProb : Float;
    actualOutcome : Bool;
  };

  type Race = {
    horses : [Horse];
    timestamp : Time.Time;
  };

  module Horse {
    public func compare(a : Horse, b : Horse) : Order.Order {
      Float.compare(a.odds, b.odds);
    };
  };

  type OddsRange = {
    min : Float;
    max : Float;
  };

  module OddsRange {
    public func compare(a : OddsRange, b : OddsRange) : Order.Order {
      switch (Float.compare(a.min, b.min)) {
        case (#equal) { Float.compare(a.max, b.max) };
        case (other) { other };
      };
    };
  };

  let raceHistory = List.empty<Race>();
  let trustWeights = Map.empty<OddsRange, Float>();

  func oddsToProb(odds : Float) : Float {
    if (odds == 0) { return 0 };
    1.0 / odds;
  };

  func mapOddsToRange(odds : Float) : OddsRange {
    if (odds < 2.0) { return { min = 1.0; max = 2.0 } };
    if (odds < 3.0) { return { min = 2.0; max = 3.0 } };
    if (odds < 5.0) { return { min = 3.0; max = 5.0 } };
    if (odds < 10.0) { return { min = 5.0; max = 10.0 } };
    { min = 10.0; max = Float.max(odds, 1000.0) };
  };

  func updateTrustWeight(oddsRange : OddsRange, correct : Bool) {
    let currentWeight = switch (trustWeights.get(oddsRange)) {
      case (null) { 0.5 };
      case (?weight) { weight };
    };
    let newWeight = if (correct) { (currentWeight + 1) / 2 } else {
      currentWeight / 2;
    };
    trustWeights.add(oddsRange, newWeight);
  };

  func isValueBet(odds : Float, prob : Float) : Bool {
    (odds * prob) > 1.0;
  };

  public shared ({ caller }) func logRace(horses : [Horse]) : async () {
    let race : Race = {
      horses;
      timestamp = Time.now();
    };
    raceHistory.add(race);

    for (horse in horses.values()) {
      let oddsRange = mapOddsToRange(horse.odds);
      let wasPredictionCorrect = horse.actualOutcome == (horse.predictedProb > 0.5);
      updateTrustWeight(oddsRange, wasPredictionCorrect);
    };
  };

  public query ({ caller }) func getValueBets(horses : [Horse]) : async [Horse] {
    let bets = List.empty<Horse>();
    for (horse in horses.values()) {
      let oddsRange = mapOddsToRange(horse.odds);
      let trustWeight = switch (trustWeights.get(oddsRange)) {
        case (null) { 0.5 };
        case (?weight) { weight };
      };
      if (isValueBet(horse.odds, horse.predictedProb) and trustWeight > 0.7) {
        bets.add(horse);
      };
    };
    bets.toArray().sort();
  };

  public query ({ caller }) func getRaceHistory() : async [Race] {
    raceHistory.toArray();
  };

  public query ({ caller }) func getTrustWeights() : async [(OddsRange, Float)] {
    trustWeights.toArray();
  };

  public query ({ caller }) func getROI() : async Float {
    var totalInvestment = 0.0;
    var totalReturn = 0.0;

    let races = raceHistory.toArray();
    for (race in races.values()) {
      for (horse in race.horses.values()) {
        totalInvestment += 1.0;
        if (horse.actualOutcome) {
          totalReturn += horse.odds;
        };
      };
    };

    if (totalInvestment == 0.0) { return 0.0 };
    (totalReturn - totalInvestment) / totalInvestment;
  };
};
