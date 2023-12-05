//
//  FastMoney.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/29/23.
//

import Foundation

public class FastMoney {
    public static var QUESTIONS: Int = 5
    
    private var answers: [Int: [FastMoneyAnswer]]?
    
    private var show: [Int: Bool]?
    
    private final var players: Int
    
    private var timer: Float = 20000
    
    private var timerRunning: Bool?
    
    public init(players: Int) {
        self.players = players
        self.reset()
    }
    
    public convenience init() {
        self.init(players: 2)
    }
    
    public func reset() {
        self.timerRunning = false
        self.timer = 20000
        self.answers = [Int: [FastMoneyAnswer]]()
        self.show = [Int: Bool]()
        
        for i in 0..<self.players {
            var answerList: [FastMoneyAnswer] = [FastMoneyAnswer]()
            for _ in 0..<FastMoney.QUESTIONS {
                answerList.append(FastMoneyAnswer())
            }
            self.answers?.updateValue(answerList, forKey: i)
            self.show?.updateValue(true, forKey: i)
        }
    }
    
    public func getAnswer(player: Int, question: Int) -> FastMoneyAnswer { return self.answers![player]![question] }
    
    public func setAnswer(player: Int, question: Int, answer: String) { self.answers![player]![question].setAnswer(answer: answer) }
    
    public func setScore(player: Int, question: Int, score: Int) { self.answers![player]![question].setScore(score: score) }
    
    public func setRevealedAnswer(player: Int, question: Int, revealed: Bool) { self.answers![player]![question].setRevealedAnswer(revealed: revealed) }
    
    public func setRevealedScore(player: Int, question: Int, revaled: Bool) { self.answers![player]![question].setRevealedScore(revealed: revaled) }
    
    public func showAnswers(player: Int) -> Bool { return self.show![player] ?? false }
    
    public func setShow(player: Int, show: Bool) { self.show!.updateValue(show, forKey: player) }
    
    public func getTimer() -> Float { return ceil(self.timer/1000) as Float }
    
    public func setTimer(timer: Float) { self.timer = timer * 1000 }
    
    public func updateTimer(timeElapsed: Float) {
        self.timer -= timeElapsed
        
        if (timer <= 0) {
            self.timer = 0
            self.timerRunning = false
        }
    }
    
    public func isTimerRunning() -> Bool { return self.timerRunning ?? false }
    
    public func setTimerRunning(running: Bool) { self.timerRunning = running }
    
    public func allAnswered(player: Int) -> Bool {
        let answers: [FastMoneyAnswer] = self.answers![player]!
        for answer in answers {
            if (answer.getScore() < 0 || answer.getAnswer().caseInsensitiveCompare("") == .orderedSame) { return false }
        }
        
        return true
    }
}


public class FastMoneyAnswer {
    private var answer: String = ""
    
    private var score: Int = -1
    
    private var revealedAnswer: Bool?
    
    private var revealedScore: Bool?
    
    public func getAnswer() -> String { return self.answer }
    
    public func getScore() -> Int { return self.score }
    
    public func isRevealedAnswer() -> Bool { return self.revealedAnswer ?? false }
    
    public func isRevealedScore() -> Bool { return self.revealedScore ?? false }
    
    public func setAnswer(answer: String) { self.answer = answer }
    
    public func setScore(score: Int) { self.score = score }
    
    public func setRevealedAnswer(revealed: Bool) { self.revealedAnswer = revealed }
    
    public func setRevealedScore(revealed: Bool) { self.revealedScore = revealed }
}
