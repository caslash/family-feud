//
//  FFStateFactory.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public class FFStateFactory {
    private static var start: FFState?
    
    private static var newGame: FFState?
    
    private static var addFamily: FFState?
    
    private static var loadQuestions: FFState?
    
    private static var initializeGame: FFState?
    
    private static var play: FFState?
    
    private static var endGame: FFState?
    
    private static var fastMoney: FFState?
    
    public init() { }
    
    public static func getState(type: FFStateType, data: Any?) -> FFState? {
        switch type {
        case .START:
            if (self.start == nil) {
                self.createStartState()
            }
            return self.start
        case .NEW_GAME:
            if (self.newGame == nil) {
                if (!(data is FamilyFeudGame)) {
                    //TODO: InvalidDataException
                    fatalError("InvalidDataException not implemented")
                }
                
                self.createNewGameStart(game: data as! FamilyFeudGame)
            }
            return self.newGame
        case .ADD_FAMILY:
            if (self.addFamily == nil) {
                if (!(data is FamilyCollection)) {
                    //TODO: InvalidDataException
                    fatalError("InvalidDataException not implemented")
                }
                self.createAddFamilyState(families: data as! FamilyCollection)
            }
            return self.addFamily
        case .LOAD_QUESTIONS:
            if (self.loadQuestions == nil) {
                if (!(data is QuestionSet)) {
                    //TODO: InvalidDataException
                    fatalError("InvalidDataException not implemented")
                }
                self.createLoadQuestionsState(questions: data as! QuestionSet)
            }
            return self.loadQuestions!
        case .INITIALIZE_GAME:
            if (self.initializeGame == nil) {
                self.createIntializeGameState()
            }
            return self.initializeGame
        case .PLAY:
            if (self.play == nil) {
                if (!(data is FamilyFeudGame)) {
                    //TODO: InvalidDataException
                    fatalError("InvalidDataException not implemented")
                }
                self.createPlayeState(game: data as! FamilyFeudGame)
            }
            return self.play
        case .END_GAME:
            if (self.endGame == nil) {
                if (!(data is FamilyFeudGame)) {
                    //TODO: InvalidDataException
                    fatalError("InvalidDataException not implemented")
                }
                self.createEndGameState(game: data as! FamilyFeudGame)
            }
            return self.endGame
        case .FAST_MONEY:
            if (self.fastMoney == nil) {
                if (!(data is FamilyFeudGame)) {
                    //TODO: InvalidDataException
                    fatalError("InvalidDataException not implemented")
                }
                self.createFastMoneyState(fastmoney: (data as! FamilyFeudGame).getFastMoney())
            }
            return self.fastMoney
        }
    }
    
    private static func createStartState() { self.start = StateStart() }
    
    private static func createPlayeState(game: FamilyFeudGame) { self.play = StatePlay(game: game) }
    
    private static func createNewGameStart(game: FamilyFeudGame) { self.newGame = StateNewGame(game: game) }
    
    private static func createLoadQuestionsState(questions: QuestionSet) { self.loadQuestions = StateLoadQuestions(questions: questions) }
    
    private static func createIntializeGameState() { self.initializeGame = StateInitializeGame() }
    
    private static func createEndGameState(game: FamilyFeudGame) { self.endGame = StateEndGame(game: game) }
    
    private static func createAddFamilyState(families: FamilyCollection) { self.addFamily = StateAddFamily(families: families) }
    
    private static func createFastMoneyState(fastmoney: FastMoney) { self.fastMoney = StateFastMoney(fastmoney: fastmoney) }
}
