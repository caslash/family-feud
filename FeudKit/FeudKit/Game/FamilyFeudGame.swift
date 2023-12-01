//
//  FamilyFeudGame.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public class FamilyFeudGame {
    public static var STRIKE_LIMIT: Int = 3
    
    private var stateMachine: FFStateMachine?
    
    private var families: FamilyCollection?
    
    private var questions: QuestionSet?
    
    private var fastmoney: FastMoney?
    
    private var winner: Family?
    
    public func initialize() {
        self.families = FamilyCollection()
        self.questions = QuestionSet()
        self.fastmoney = FastMoney()
        self.winner = nil
        
        self.stateMachine = FFStateMachine(game: self, families: self.families!, questions: self.questions!)
        self.stateMachine!.initialize()
    }
    
    public func reset() {
        self.families!.reset()
        self.questions!.reset()
        self.winner = nil
    }
    
    public func changeState(type: FFStateType) -> Bool { return self.stateMachine?.changeState(name: type.description) ?? false }
    
    public func getState() -> FFState { return self.stateMachine!.getCurrentState()! }
    
    public func getFastMoney() -> FastMoney { return self.fastmoney! }
    
    public func getFamilies() -> [Family] { return self.families!.getFamilies() }
    
    public func getQuestions() -> [Question] { return self.questions!.getQuestions() }
    
    public func getQuestionSet() -> QuestionSet { return self.questions! }
    
    public func getFamilyCollection() -> FamilyCollection { return self.families! }
    
    private func setWinner() {
        var index: Int = 0
        var families: [Family] = self.getFamilies()
        for i in 0..<families.count {
            if (families[i].getPoints() > families[index].getPoints()) {
                index = i
            }
        }
        self.winner = families[index]
    }
    
    public func getWinningFamily() -> Family {
        self.setWinner()
        return self.winner!
    }
    
    public func finished() -> Bool { return self.winner != nil }
}
